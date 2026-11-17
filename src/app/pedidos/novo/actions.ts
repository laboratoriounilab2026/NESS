"use server";

import { issuesByPath, orderSchema } from "@/domain/order-input";
import { resolveRule, type FiscalRuleRecord, type Resolution } from "@/fiscal/matrix";

// ponytail: sem Postgres ainda — regras e estabelecimento virão das tabelas FiscalRule/Establishment.
// Lista vazia de propósito: nenhuma regra foi aprovada pelo responsável fiscal, então tudo bloqueia.
const APPROVED_RULES: FiscalRuleRecord[] = [];
const ESTABLISHMENT_ID = "pendente-cadastro";

export type CheckResult =
  | { ok: false; errors: Record<string, string> }
  | { ok: true; nfse: Resolution; nfe: Resolution };

/** Revalida o pedido no servidor e consulta a matriz para as duas notas, de forma independente. */
export async function checkOrder(raw: unknown): Promise<CheckResult> {
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issuesByPath(parsed.error) };

  const at = new Date();
  const base = { establishmentId: ESTABLISHMENT_ID, at };
  return {
    ok: true,
    nfse: resolveRule(APPROVED_RULES, { ...base, docType: "NFSE", purpose: "servico-fotografico" }),
    nfe: resolveRule(APPROVED_RULES, { ...base, docType: "NFE", purpose: "album", ufDestino: parsed.data.recipient.uf }),
  };
}
