"use server";

import { audit } from "@/audit/audit";
import { requireUser } from "@/auth/session";
import { isValidDocument, issuesByPath, normalizeDocument, orderSchema, type OrderInput } from "@/domain/order-input";
import type { Resolution } from "@/fiscal/matrix";
import { resolveOrderRules } from "@/fiscal/resolve-order";
import { db } from "@/lib/db";

export type CheckResult =
  | { ok: false; errors: Record<string, string> }
  | { ok: true; nfse: Resolution; nfe: Resolution };

export type SaveResult = { ok: false; errors?: Record<string, string>; message?: string } | { ok: true; id: string };

const blocked = (reason: string): Resolution => ({ status: "blocked", reason });

/** Resolve as duas notas de forma independente. */
async function resolveBoth(data: OrderInput) {
  // ponytail: sem empresa na sessão ainda — usa o único estabelecimento cadastrado; com mais de um, bloqueia.
  const establishments = await db.establishment.findMany({ select: { id: true }, take: 2 });
  if (establishments.length !== 1) {
    const reason = establishments.length === 0
      ? "Nenhum estabelecimento cadastrado. Um administrador precisa cadastrar a empresa emissora."
      : "Há mais de um estabelecimento e a escolha ainda não está disponível.";
    return { establishmentId: null, nfse: blocked(reason), nfe: blocked(reason) };
  }
  const establishmentId = establishments[0].id;
  return { establishmentId, ...(await resolveOrderRules(establishmentId, data.recipient.uf)) };
}

/** Revalida o pedido no servidor e consulta a matriz para as duas notas. */
export async function checkOrder(raw: unknown): Promise<CheckResult> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issuesByPath(parsed.error) };

  const { nfse, nfe } = await resolveBoth(parsed.data);
  await audit({
    actor: user.id,
    action: "pedido.verificacao_fiscal",
    entity: "EmissionOrder",
    entityId: "rascunho",
    result: nfse.status === "ok" && nfe.status === "ok" ? "liberado" : "bloqueado",
    correlationId: crypto.randomUUID(),
    data: { nfse: nfse.status, nfe: nfe.status, ufDestino: parsed.data.recipient.uf },
  });
  return { ok: true, nfse, nfe };
}

/** Cadastro existente do tomador, para preencher nome/e-mail. Só com documento válido (não serve para varrer a base). */
export async function lookupCustomer(document: unknown): Promise<{ name: string; email: string } | null> {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  if (typeof document !== "string" || !isValidDocument(document)) return null;
  const c = await db.customer.findFirst({ where: { document: normalizeDocument(document) }, select: { name: true, email: true } });
  return c ? { name: c.name, email: c.email ?? "" } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Grava o pedido com as duas notas PENDENTES (nada é transmitido aqui).
 * Idempotente pela `ref` gerada no navegador: clique duplo/reenvio devolve o mesmo pedido.
 */
export async function saveOrder(raw: unknown, ref: string): Promise<SaveResult> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  if (!UUID.test(ref)) return { ok: false, message: "Referência do rascunho inválida. Recarregue a página." };
  const existing = await db.emissionOrder.findUnique({ where: { ref }, select: { id: true } });
  if (existing) return { ok: true, id: existing.id };

  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issuesByPath(parsed.error) };
  const d = parsed.data;
  const { establishmentId, nfse, nfe } = await resolveBoth(d);
  if (!establishmentId) return { ok: false, message: nfse.status === "blocked" ? nfse.reason : "Sem estabelecimento." };

  const ruleOf = (r: Resolution) => (r.status === "ok" ? r.ruleId : null);
  const correlationId = crypto.randomUUID();
  let id: string;
  let customerUpdated: string | null = null;
  try {
    id = await db.$transaction(async (tx) => {
      // Um cadastro por tomador (documento normalizado). O nome/e-mail digitados agora são os atuais: atualizam o cadastro.
      const c = d.customer;
      // Serializa salvamentos simultâneos do mesmo tomador (sem isso, dois pedidos novos criariam dois cadastros).
      // ponytail: trava em vez de UNIQUE: o índice exige fundir duplicados antigos antes (migração irreversível, pede confirmação).
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`customer:${c.document}`}))`;
      const found = await tx.customer.findFirst({ where: { document: c.document }, select: { id: true, name: true, email: true } });
      const customer = found ?? (await tx.customer.create({ data: { document: c.document, name: c.name, email: c.email || null }, select: { id: true } }));
      if (found && (found.name !== c.name || (found.email ?? "") !== c.email)) {
        await tx.customer.update({ where: { id: found.id }, data: { name: c.name, email: c.email || null } });
        customerUpdated = found.id;
      }
      const r = d.recipient;
      const recipient = await tx.recipient.create({
        data: { name: r.name, document: r.document || null, cep: r.cep, street: r.street, number: r.number, district: r.district, city: r.city, uf: r.uf },
      });
      const order = await tx.emissionOrder.create({
        data: {
          ref,
          state: nfse.status === "ok" && nfe.status === "ok" ? "PRONTO_REVISAO" : "BLOQUEADO",
          establishmentId,
          customerId: customer.id,
          recipientId: recipient.id,
          serviceCents: d.service.value,
          goodsCents: d.goods.quantity * d.goods.unitValue,
          serviceDescription: d.service.description,
          goodsDescription: d.goods.description,
          goodsQuantity: d.goods.quantity,
          goodsUnitCents: d.goods.unitValue,
          documents: { create: [{ type: "NFSE", fiscalRuleId: ruleOf(nfse) }, { type: "NFE", fiscalRuleId: ruleOf(nfe) }] },
        },
      });
      return order.id;
    });
  } catch (e) {
    // Corrida de dois cliques: a ref única garante um só pedido.
    const again = await db.emissionOrder.findUnique({ where: { ref }, select: { id: true } });
    if (again) return { ok: true, id: again.id };
    throw e;
  }

  if (customerUpdated) {
    await audit({ actor: user.id, action: "cliente.atualizar", entity: "Customer", entityId: customerUpdated, result: "atualizado", correlationId, data: { origem: "pedido" } });
  }
  await audit({
    actor: user.id, action: "pedido.criar", entity: "EmissionOrder", entityId: id, result: "criado", correlationId,
    data: { nfse: nfse.status, nfe: nfe.status, ufDestino: d.recipient.uf },
  });
  return { ok: true, id };
}
