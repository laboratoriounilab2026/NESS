"use server";

import { audit } from "@/audit/audit";
import { issuesByPath, orderSchema } from "@/domain/order-input";
import { resolveRule, type Resolution } from "@/fiscal/matrix";
import { db } from "@/lib/db";

export type CheckResult =
  | { ok: false; errors: Record<string, string> }
  | { ok: true; nfse: Resolution; nfe: Resolution };

const blocked = (reason: string): Resolution => ({ status: "blocked", reason });

/** Revalida o pedido no servidor e consulta a matriz para as duas notas, de forma independente. */
export async function checkOrder(raw: unknown): Promise<CheckResult> {
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issuesByPath(parsed.error) };

  const correlationId = crypto.randomUUID();
  // ponytail: sem login/empresa na sessão ainda — usa o único estabelecimento cadastrado; com mais de um, bloqueia.
  const establishments = await db.establishment.findMany({ select: { id: true }, take: 2 });
  let result: CheckResult;
  if (establishments.length !== 1) {
    const reason = establishments.length === 0
      ? "Nenhum estabelecimento cadastrado. Um administrador precisa cadastrar a empresa emissora."
      : "Há mais de um estabelecimento e a escolha ainda não está disponível.";
    result = { ok: true, nfse: blocked(reason), nfe: blocked(reason) };
  } else {
    const establishmentId = establishments[0].id;
    const rules = await db.fiscalRule.findMany({ where: { establishmentId, approvedAt: { not: null } } });
    const base = { establishmentId, at: new Date() };
    result = {
      ok: true,
      nfse: resolveRule(rules, { ...base, docType: "NFSE", purpose: "servico-fotografico" }),
      nfe: resolveRule(rules, { ...base, docType: "NFE", purpose: "album", ufDestino: parsed.data.recipient.uf }),
    };
  }

  await audit({
    actor: "anonimo", // ponytail: vira o usuário da sessão quando houver login
    action: "pedido.verificacao_fiscal",
    entity: "EmissionOrder",
    entityId: "rascunho",
    result: result.nfse.status === "ok" && result.nfe.status === "ok" ? "liberado" : "bloqueado",
    correlationId,
    data: { nfse: result.nfse.status, nfe: result.nfe.status, ufDestino: parsed.data.recipient.uf },
  });
  return result;
}
