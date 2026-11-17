// Estados e transições do NESS (docs/PLANO_NESS.md › Estados). Fonte única: UI e banco derivam daqui.

export const DOC_TYPES = ["NFSE", "NFE"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_STATES = ["PENDENTE", "ENVIADO", "INCERTO", "AUTORIZADO", "REJEITADO", "DENEGADO", "CANCELAMENTO_SOLICITADO", "CANCELADO"] as const;
export type DocState = (typeof DOC_STATES)[number];

// INCERTO = timeout/sem resposta: só sai por consulta ao emissor (reconciliação), nunca por reenvio cego.
const DOC_TRANSITIONS: Record<DocState, readonly DocState[]> = {
  PENDENTE: ["ENVIADO"],
  ENVIADO: ["AUTORIZADO", "REJEITADO", "DENEGADO", "INCERTO"],
  INCERTO: ["AUTORIZADO", "REJEITADO", "DENEGADO", "PENDENTE"], // PENDENTE só após consulta confirmar que não existe
  REJEITADO: ["PENDENTE"], // nova tentativa após correção
  AUTORIZADO: ["CANCELAMENTO_SOLICITADO"],
  CANCELAMENTO_SOLICITADO: ["CANCELADO", "AUTORIZADO"], // AUTORIZADO = cancelamento negado
  DENEGADO: [],
  CANCELADO: [],
};

export function canTransition(from: DocState, to: DocState): boolean {
  return DOC_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DocState, to: DocState): void {
  if (!canTransition(from, to)) throw new Error(`Transição inválida: ${from} → ${to}`);
}

export const ORDER_STATES = ["RASCUNHO", "VALIDANDO", "PRONTO_REVISAO", "BLOQUEADO", "EMITINDO", "COMPLETO", "PARCIAL", "FALHA", "CANCELAMENTO_SOLICITADO"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

/**
 * Estado do pedido após o início da emissão, derivado dos documentos (não é armazenado de forma independente).
 * COMPLETO só com TODOS autorizados — nunca presume sucesso sem confirmação do emissor.
 */
export function deriveOrderState(docs: readonly DocState[]): OrderState {
  if (docs.length === 0) throw new Error("Pedido sem documentos");
  const ok = docs.filter((d) => d === "AUTORIZADO").length;
  if (docs.some((d) => d === "CANCELAMENTO_SOLICITADO")) return "CANCELAMENTO_SOLICITADO";
  if (ok === docs.length) return "COMPLETO";
  if (docs.some((d) => d === "PENDENTE" || d === "ENVIADO" || d === "INCERTO")) return "EMITINDO";
  if (ok > 0) return "PARCIAL";
  return "FALHA";
}

/** Chave de idempotência: pedido + tipo + tentativa (CLAUDE.md › Segurança e confiabilidade). */
export function idempotencyKey(orderId: string, docType: DocType, attempt: number): string {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Tentativa deve ser inteiro ≥ 1");
  return `${orderId}:${docType}:${attempt}`;
}
