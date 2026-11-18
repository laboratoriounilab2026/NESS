import "server-only";
import { audit } from "@/audit/audit";
import type { EmitRequest, EmitterAdapter, QueryResult, SendResult } from "@/emitters/types";
import { assertTransition, deriveOrderState, idempotencyKey, type DocState } from "@/domain/states";
import { db } from "@/lib/db";

// Orquestrador de uma nota. Garantias:
// - uma tentativa por vez (trava PENDENTE→ENVIADO atômica) e chave de idempotência única no banco;
// - timeout vira INCERTO e só sai por consulta ao emissor (reconcile), nunca por reenvio cego;
// - o estado do pedido é sempre derivado das notas (sucesso parcial representado).

export type Outcome = { state: DocState; detail?: string };

type Ctx = { actor: string; correlationId: string };

const SEND_TO_STATE: Record<SendResult["kind"], DocState> = { authorized: "AUTORIZADO", rejected: "REJEITADO", denied: "DENEGADO", timeout: "INCERTO" };
const QUERY_TO_STATE: Record<QueryResult["kind"], DocState> = { authorized: "AUTORIZADO", rejected: "REJEITADO", not_found: "PENDENTE", unknown: "INCERTO" };

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
/** Trava por pedido até o fim da transação (serializa envio × descarte × correção de destinatário). */
export const lockOrder = (tx: Tx, orderId: string) => tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`order:${orderId}`}))`;

async function syncOrder(orderId: string) {
  const docs = await db.emissionDocument.findMany({ where: { orderId }, select: { state: true } });
  await db.emissionOrder.update({ where: { id: orderId }, data: { state: deriveOrderState(docs.map((d) => d.state)) } });
}

// Resposta guardada sem dados pessoais: só tipo, código e mensagem do emissor.
const summarize = (r: SendResult | QueryResult) => ({ kind: r.kind, ...("code" in r ? { code: r.code, message: r.message.slice(0, 300) } : {}) });

export async function emitDocument(documentId: string, adapter: EmitterAdapter, ctx: Ctx): Promise<Outcome> {
  const doc = await db.emissionDocument.findUniqueOrThrow({ where: { id: documentId }, include: { _count: { select: { attempts: true } } } });
  if (doc.state !== "PENDENTE") return { state: doc.state, detail: "Nota não está pendente; nada enviado." };
  if (!doc.fiscalRuleId) return { state: doc.state, detail: "Nota sem regra fiscal aprovada; envio bloqueado." };

  // Trava: só um processo passa de PENDENTE para ENVIADO, e nunca num pedido descartado
  // (mesma trava por pedido que discardOrder usa; sem ela, descartar e emitir juntos poderiam ambos passar).
  const locked = await db.$transaction(async (tx) => {
    await lockOrder(tx, doc.orderId);
    const order = await tx.emissionOrder.findUniqueOrThrow({ where: { id: doc.orderId }, select: { state: true } });
    if (order.state === "DESCARTADO") return "descartado" as const;
    const { count } = await tx.emissionDocument.updateMany({ where: { id: documentId, state: "PENDENTE" }, data: { state: "ENVIADO" } });
    return count === 1 ? ("ok" as const) : ("em_andamento" as const);
  });
  if (locked === "descartado") return { state: doc.state, detail: "Pedido descartado; nada enviado." };
  if (locked !== "ok") return { state: "ENVIADO", detail: "Envio já em andamento." };

  const seq = doc._count.attempts + 1;
  const req: EmitRequest = { documentId, docType: doc.type, idempotencyKey: idempotencyKey(doc.orderId, doc.type, seq) };
  const attempt = await db.emissionAttempt.create({ data: { documentId, seq, idempotencyKey: req.idempotencyKey, correlationId: ctx.correlationId } });

  let result: SendResult;
  try {
    result = await adapter.send(req);
  } catch {
    result = { kind: "timeout" }; // erro de rede/processo: estado desconhecido, tratar como incerto
  }
  const state = SEND_TO_STATE[result.kind];
  assertTransition("ENVIADO", state);

  await db.$transaction([
    db.emissionAttempt.update({ where: { id: attempt.id }, data: { resultState: state, responseSummary: summarize(result), finishedAt: new Date() } }),
    db.emissionDocument.update({
      where: { id: documentId },
      data: { state, ...(result.kind === "authorized" ? { accessKey: result.accessKey, protocol: result.protocol } : {}) },
    }),
  ]);
  await syncOrder(doc.orderId);
  await audit({ actor: ctx.actor, action: "nota.enviar", entity: "EmissionDocument", entityId: documentId, result: state, correlationId: ctx.correlationId, data: { docType: doc.type, seq } });
  return { state, detail: "code" in result ? `${result.code}: ${result.message}` : undefined };
}

/** Após timeout: consulta o emissor pela chave da última tentativa antes de qualquer reenvio. */
export async function reconcileDocument(documentId: string, adapter: EmitterAdapter, ctx: Ctx): Promise<Outcome> {
  const doc = await db.emissionDocument.findUniqueOrThrow({ where: { id: documentId }, include: { attempts: { orderBy: { seq: "desc" }, take: 1 } } });
  const last = doc.attempts[0];
  if (doc.state !== "INCERTO") return { state: doc.state, detail: "Nada a reconciliar." };
  if (!last) {
    // Processo caiu entre a trava e o registro da tentativa: nada foi enviado e não há chave para consultar.
    assertTransition("INCERTO", "PENDENTE");
    await db.emissionDocument.updateMany({ where: { id: documentId, state: "INCERTO" }, data: { state: "PENDENTE" } });
    await syncOrder(doc.orderId);
    await audit({ actor: ctx.actor, action: "nota.reconciliar", entity: "EmissionDocument", entityId: documentId, result: "PENDENTE", correlationId: ctx.correlationId, data: { consulta: "sem_tentativa" } });
    return { state: "PENDENTE" };
  }

  let result: QueryResult;
  try {
    result = await adapter.query({ documentId, docType: doc.type, idempotencyKey: last.idempotencyKey });
  } catch {
    result = { kind: "unknown" };
  }
  const state = QUERY_TO_STATE[result.kind];
  if (state !== "INCERTO") {
    assertTransition("INCERTO", state);
    await db.$transaction([
      db.emissionAttempt.update({ where: { id: last.id }, data: { resultState: state, responseSummary: summarize(result), finishedAt: new Date() } }),
      db.emissionDocument.update({
        where: { id: documentId },
        data: { state, ...(result.kind === "authorized" ? { accessKey: result.accessKey, protocol: result.protocol } : {}) },
      }),
    ]);
    await syncOrder(doc.orderId);
  }
  await audit({ actor: ctx.actor, action: "nota.reconciliar", entity: "EmissionDocument", entityId: documentId, result: state, correlationId: ctx.correlationId, data: { consulta: result.kind } });
  return { state };
}

/**
 * Desistência antes de qualquer envio: só se nenhuma nota tem tentativa registrada (nada pode existir no governo).
 * Pedido fica no histórico como DESCARTADO; nunca mais é emitido.
 */
export async function discardOrder(orderId: string, ctx: Ctx): Promise<{ ok: true } | { ok: false; reason: string }> {
  const r = await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.emissionOrder.findUnique({
      where: { id: orderId },
      select: { state: true, documents: { select: { state: true, _count: { select: { attempts: true } } } } },
    });
    if (!order) return { ok: false, reason: "Pedido não encontrado." } as const;
    const untouched = order.documents.every((d) => d.state === "PENDENTE" && d._count.attempts === 0);
    if (!["PRONTO_REVISAO", "BLOQUEADO"].includes(order.state) || !untouched) {
      return { ok: false, reason: "Só é possível descartar pedido sem nenhuma nota enviada." } as const;
    }
    await tx.emissionOrder.update({ where: { id: orderId }, data: { state: "DESCARTADO" } });
    return { ok: true } as const;
  });
  await audit({ actor: ctx.actor, action: "pedido.descartar", entity: "EmissionOrder", entityId: orderId, result: r.ok ? "descartado" : "recusado", correlationId: ctx.correlationId });
  return r;
}

/** Tempo sem resposta após o qual um envio é considerado interrompido. */
export const STALE_SENT_MS = 5 * 60_000;

/**
 * Envio interrompido (processo caiu, deploy no meio do envio): nota ENVIADO cuja última tentativa não terminou
 * há mais de `staleMs` vira INCERTO e, como timeout, só sai por consulta ao emissor. Nunca reenvia.
 */
export async function markStaleSent(orderId: string, ctx: Ctx, staleMs = STALE_SENT_MS): Promise<number> {
  assertTransition("ENVIADO", "INCERTO");
  const cutoff = new Date(Date.now() - staleMs);
  const docs = await db.emissionDocument.findMany({
    where: { orderId, state: "ENVIADO", updatedAt: { lt: cutoff } },
    include: { attempts: { orderBy: { seq: "desc" }, take: 1 } },
  });
  const stale = docs.filter((d) => !d.attempts[0] || (d.attempts[0].finishedAt === null && d.attempts[0].startedAt < cutoff)).map((d) => d.id);
  if (stale.length === 0) return 0;
  const { count } = await db.emissionDocument.updateMany({ where: { id: { in: stale }, state: "ENVIADO" }, data: { state: "INCERTO" } });
  await syncOrder(orderId);
  await audit({ actor: ctx.actor, action: "nota.envio_interrompido", entity: "EmissionOrder", entityId: orderId, result: "INCERTO", correlationId: ctx.correlationId, data: { notas: count } });
  return count;
}

/** Emite as duas notas do pedido, uma após a outra. Falha de uma não impede a outra. */
export async function emitOrder(orderId: string, adapters: Record<"NFSE" | "NFE", EmitterAdapter>, ctx: Ctx) {
  const docs = await db.emissionDocument.findMany({ where: { orderId }, orderBy: { type: "asc" } }); // NFSE, NFE (ordem do enum)
  const out: Record<string, Outcome> = {};
  for (const d of docs) out[d.type] = await emitDocument(d.id, adapters[d.type], ctx);
  const order = await db.emissionOrder.findUniqueOrThrow({ where: { id: orderId }, select: { state: true } });
  return { order: order.state, docs: out };
}

/**
 * Nova tentativa após rejeição: REJEITADO → PENDENTE (DENEGADO nunca volta). O próximo envio usa nova chave
 * de idempotência (seq+1). Quem chama deve revalidar a regra fiscal antes de emitir.
 */
export async function reopenRejected(orderId: string, ctx: Ctx): Promise<number> {
  assertTransition("REJEITADO", "PENDENTE");
  const { count } = await db.emissionDocument.updateMany({ where: { orderId, state: "REJEITADO" }, data: { state: "PENDENTE" } });
  if (count === 0) return 0;
  await syncOrder(orderId);
  await audit({ actor: ctx.actor, action: "nota.reabrir", entity: "EmissionOrder", entityId: orderId, result: "PENDENTE", correlationId: ctx.correlationId, data: { notas: count } });
  return count;
}
