import "server-only";
import { db } from "@/lib/db";
import { resolveRule, type Resolution } from "./matrix";

/** Regras das duas notas de um pedido, resolvidas de forma independente (fonte única para cadastro e revalidação). */
export async function resolveOrderRules(establishmentId: string, ufDestino: string): Promise<{ nfse: Resolution; nfe: Resolution }> {
  const rules = await db.fiscalRule.findMany({ where: { establishmentId, approvedAt: { not: null } } });
  const base = { establishmentId, at: new Date() };
  return {
    nfse: resolveRule(rules, { ...base, docType: "NFSE", purpose: "servico-fotografico" }),
    nfe: resolveRule(rules, { ...base, docType: "NFE", purpose: "album", ufDestino }),
  };
}

const REVISABLE = ["BLOQUEADO", "PRONTO_REVISAO"] as const;

/**
 * Recalcula as regras das notas ainda PENDENTES de um pedido salvo (regra pode ter sido aprovada ou ter vencido
 * depois do cadastro). Só move o pedido entre BLOQUEADO e PRONTO_REVISAO; pedido já em emissão mantém o estado.
 */
export async function refreshOrderRules(orderId: string) {
  const order = await db.emissionOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { recipient: { select: { uf: true } }, documents: { select: { id: true, type: true, state: true } } },
  });
  const blocked = (reason: string): Resolution => ({ status: "blocked", reason });
  const res = order.recipient
    ? await resolveOrderRules(order.establishmentId, order.recipient.uf)
    : { nfse: blocked("Pedido sem destinatário."), nfe: blocked("Pedido sem destinatário.") };
  const byType = { NFSE: res.nfse, NFE: res.nfe };

  const pending = order.documents.filter((d) => d.state === "PENDENTE");
  const allOk = order.documents.every((d) => d.state !== "PENDENTE" || byType[d.type].status === "ok");
  await db.$transaction([
    ...pending.map((d) => {
      const r = byType[d.type];
      return db.emissionDocument.update({ where: { id: d.id }, data: { fiscalRuleId: r.status === "ok" ? r.ruleId : null } });
    }),
    ...((REVISABLE as readonly string[]).includes(order.state)
      ? [db.emissionOrder.update({ where: { id: orderId }, data: { state: allOk ? "PRONTO_REVISAO" : "BLOQUEADO" } })]
      : []),
  ]);
  return byType;
}
