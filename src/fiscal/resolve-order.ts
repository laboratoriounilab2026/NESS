import "server-only";
import { db } from "@/lib/db";
import { lockOrder } from "@/lib/order-lock";
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

  // Sob a trava do pedido e relendo estados: uma nota enviada no meio tempo não tem a regra trocada.
  await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const now = await tx.emissionOrder.findUniqueOrThrow({ where: { id: orderId }, select: { state: true, documents: { select: { id: true, type: true, state: true } } } });
    const pending = now.documents.filter((d) => d.state === "PENDENTE");
    for (const d of pending) {
      const r = byType[d.type];
      await tx.emissionDocument.update({ where: { id: d.id }, data: { fiscalRuleId: r.status === "ok" ? r.ruleId : null } });
    }
    if ((REVISABLE as readonly string[]).includes(now.state)) {
      const allOk = now.documents.every((d) => d.state !== "PENDENTE" || byType[d.type].status === "ok");
      await tx.emissionOrder.update({ where: { id: orderId }, data: { state: allOk ? "PRONTO_REVISAO" : "BLOQUEADO" } });
    }
  });
  return byType;
}
