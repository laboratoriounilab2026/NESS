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

  // Trava: só um processo consegue passar de PENDENTE para ENVIADO.
  const { count } = await db.emissionDocument.updateMany({ where: { id: documentId, state: "PENDENTE" }, data: { state: "ENVIADO" } });
  if (count !== 1) return { state: "ENVIADO", detail: "Envio já em andamento." };

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
  if (doc.state !== "INCERTO" || !last) return { state: doc.state, detail: "Nada a reconciliar." };

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

/** Emite as duas notas do pedido, uma após a outra. Falha de uma não impede a outra. */
export async function emitOrder(orderId: string, adapters: Record<"NFSE" | "NFE", EmitterAdapter>, ctx: Ctx) {
  const docs = await db.emissionDocument.findMany({ where: { orderId }, orderBy: { type: "asc" } }); // NFSE, NFE (ordem do enum)
  const out: Record<string, Outcome> = {};
  for (const d of docs) out[d.type] = await emitDocument(d.id, adapters[d.type], ctx);
  const order = await db.emissionOrder.findUniqueOrThrow({ where: { id: orderId }, select: { state: true } });
  return { order: order.state, docs: out };
}
