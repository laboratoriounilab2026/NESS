"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { issuesByPath, recipientSchema } from "@/domain/order-input";
import { audit } from "@/audit/audit";
import { requireUser } from "@/auth/session";
import { getAdapter } from "@/emitters/registry";
import { refreshOrderRules } from "@/fiscal/resolve-order";
import { db } from "@/lib/db";
import { emitDocument, reconcileDocument, reopenRejected, type Outcome } from "@/orchestrator/emit";

export type ActionResult = { ok: boolean; message: string; docs?: Partial<Record<"NFSE" | "NFE", Outcome>> };

const LABEL = { NFSE: "NFS-e", NFE: "NF-e" } as const;
const EMITTABLE = ["PRONTO_REVISAO", "EMITINDO"] as const;

/** Envia as notas PENDENTES do pedido (NFS-e primeiro). Uma falhar não impede a outra. */
export async function emitOrderAction(orderId: string, confirmed: boolean): Promise<ActionResult> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  if (confirmed !== true) return { ok: false, message: "Confirme a emissão antes de enviar." };

  const exists = await db.emissionOrder.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!exists) return { ok: false, message: "Pedido não encontrado." };
  // Regra precisa estar aprovada e vigente AGORA, não só quando o pedido foi salvo.
  await refreshOrderRules(orderId);

  const order = await db.emissionOrder.findUnique({
    where: { id: orderId },
    include: { documents: { where: { state: "PENDENTE" }, orderBy: { type: "asc" } } },
  });
  if (!order) return { ok: false, message: "Pedido não encontrado." };
  if (!(EMITTABLE as readonly string[]).includes(order.state)) {
    return { ok: false, message: order.state === "BLOQUEADO" ? "Pedido bloqueado: falta regra fiscal aprovada." : "Este pedido não tem notas a emitir." };
  }
  if (order.documents.length === 0) return { ok: false, message: "Nenhuma nota pendente neste pedido." };

  const correlationId = crypto.randomUUID();
  const ctx = { actor: user.id, correlationId };
  const docs: ActionResult["docs"] = {};
  const notConfigured: string[] = [];
  for (const d of order.documents) {
    const adapter = getAdapter(d.type);
    if (!adapter) {
      notConfigured.push(LABEL[d.type]);
      continue;
    }
    docs[d.type] = await emitDocument(d.id, adapter, ctx);
  }
  if (notConfigured.length) {
    await audit({ actor: user.id, action: "pedido.emitir", entity: "EmissionOrder", entityId: orderId, result: "bloqueado", correlationId, data: { semTransmissao: notConfigured.join(",") } });
  }
  revalidatePath(`/pedidos/${orderId}`);

  const sent = Object.keys(docs).length;
  if (sent === 0) {
    return { ok: false, message: `Transmissão ao governo ainda não configurada (${notConfigured.join(", ")}). Nada foi enviado.` };
  }
  return {
    ok: true,
    docs,
    message: notConfigured.length ? `Envio feito para parte das notas. Sem transmissão configurada: ${notConfigured.join(", ")}.` : "Envio concluído. Veja o resultado de cada nota.",
  };
}

/** Consulta o governo sobre notas sem resposta (INCERTO) antes de qualquer reenvio. */
export async function reconcileOrderAction(orderId: string): Promise<ActionResult> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const docs = await db.emissionDocument.findMany({ where: { orderId, state: "INCERTO" }, orderBy: { type: "asc" } });
  if (docs.length === 0) return { ok: false, message: "Nenhuma nota aguardando confirmação." };
  const ctx = { actor: user.id, correlationId: crypto.randomUUID() };
  const out: ActionResult["docs"] = {};
  for (const d of docs) {
    const adapter = getAdapter(d.type);
    if (adapter) out[d.type] = await reconcileDocument(d.id, adapter, ctx);
  }
  revalidatePath(`/pedidos/${orderId}`);
  return Object.keys(out).length
    ? { ok: true, docs: out, message: "Consulta feita. Veja o estado atualizado de cada nota." }
    : { ok: false, message: "Transmissão ao governo ainda não configurada; não há como consultar." };
}

/** Libera nota rejeitada para nova tentativa. Só FISCAL/ADMIN: exige ter conferido o motivo da rejeição. */
export async function retryRejectedAction(orderId: string, confirmed: boolean): Promise<ActionResult> {
  const user = await requireUser("FISCAL", "ADMIN");
  if (confirmed !== true) return { ok: false, message: "Confirme que o motivo da rejeição foi corrigido." };
  const n = await reopenRejected(orderId, { actor: user.id, correlationId: crypto.randomUUID() });
  if (n === 0) return { ok: false, message: "Nenhuma nota rejeitada neste pedido." };
  await refreshOrderRules(orderId); // regra pode ter mudado (nova versão aprovada) desde a rejeição
  revalidatePath(`/pedidos/${orderId}`);
  return { ok: true, message: "Nota liberada para nova tentativa. Confira e emita de novo." };
}

const recipientEdit = recipientSchema.omit({ same: true });
export type RecipientEdit = z.input<typeof recipientEdit>;
const EDITABLE_NFE = ["PENDENTE", "REJEITADO"];

/**
 * Corrige o destinatário (NF-e) enquanto a NF-e não foi enviada ou foi rejeitada. Cria um registro novo e
 * aponta o pedido para ele: o anterior fica intacto para histórico. UF pode mudar → regras recalculadas.
 */
export async function updateRecipientAction(orderId: string, raw: unknown): Promise<ActionResult & { errors?: Record<string, string> }> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const parsed = recipientEdit.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Revise os campos destacados.", errors: issuesByPath(parsed.error) };
  const nfe = await db.emissionDocument.findFirst({ where: { orderId, type: "NFE" }, select: { state: true } });
  if (!nfe) return { ok: false, message: "Pedido não encontrado." };
  if (!EDITABLE_NFE.includes(nfe.state)) return { ok: false, message: "A NF-e já foi enviada; o destinatário não pode mais ser alterado aqui." };

  const r = parsed.data;
  await db.$transaction(async (tx) => {
    const rec = await tx.recipient.create({
      data: { name: r.name, document: r.document || null, cep: r.cep, street: r.street, number: r.number, district: r.district, city: r.city, uf: r.uf },
    });
    await tx.emissionOrder.update({ where: { id: orderId }, data: { recipientId: rec.id } });
  });
  await refreshOrderRules(orderId);
  await audit({ actor: user.id, action: "pedido.corrigir_destinatario", entity: "EmissionOrder", entityId: orderId, result: "ok", correlationId: crypto.randomUUID(), data: { ufDestino: r.uf } });
  revalidatePath(`/pedidos/${orderId}`);
  return { ok: true, message: "Destinatário atualizado." };
}

/** Recalcula as regras de um pedido bloqueado (ex.: o responsável fiscal aprovou a regra depois do cadastro). */
export async function recheckRulesAction(orderId: string): Promise<ActionResult> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const order = await db.emissionOrder.findUnique({ where: { id: orderId }, select: { state: true } });
  if (!order) return { ok: false, message: "Pedido não encontrado." };
  if (order.state !== "BLOQUEADO") return { ok: false, message: "Só pedidos bloqueados precisam ser verificados de novo." };

  const r = await refreshOrderRules(orderId);
  const ok = r.NFSE.status === "ok" && r.NFE.status === "ok";
  await audit({
    actor: user.id, action: "pedido.reverificar_regras", entity: "EmissionOrder", entityId: orderId,
    result: ok ? "liberado" : "bloqueado", correlationId: crypto.randomUUID(), data: { nfse: r.NFSE.status, nfe: r.NFE.status },
  });
  revalidatePath(`/pedidos/${orderId}`);
  if (ok) return { ok: true, message: "Regras encontradas para as duas notas. O pedido está pronto para emitir." };
  const why = [r.NFSE, r.NFE].flatMap((x, i) => (x.status === "blocked" ? [`${i ? "NF-e" : "NFS-e"}: ${x.reason}`] : []));
  return { ok: false, message: `Continua bloqueado. ${why.join(" ")}` };
}
