import type { DocStatus } from "@/components/status-badge";
import type { DocState, OrderState } from "@/generated/prisma/client";

// Rótulos da interface. "Autorizada" só aparece com estado AUTORIZADO, que só o emissor real produz.
export const DOC_BADGE: Record<DocState, { status: DocStatus; label: string }> = {
  PENDENTE: { status: "draft", label: "Pendente" },
  ENVIADO: { status: "wait", label: "Transmitindo" },
  INCERTO: { status: "wait", label: "Aguardando confirmação" },
  AUTORIZADO: { status: "ok", label: "Autorizada" },
  REJEITADO: { status: "err", label: "Rejeitada" },
  DENEGADO: { status: "err", label: "Denegada" },
  CANCELAMENTO_SOLICITADO: { status: "wait", label: "Cancelamento solicitado" },
  CANCELADO: { status: "draft", label: "Cancelada" },
};

export const ORDER_BADGE: Record<OrderState, { status: DocStatus; label: string }> = {
  RASCUNHO: { status: "draft", label: "Rascunho" },
  VALIDANDO: { status: "wait", label: "Validando" },
  PRONTO_REVISAO: { status: "draft", label: "Pronto para emitir" },
  BLOQUEADO: { status: "block", label: "Sem regra fiscal" },
  EMITINDO: { status: "wait", label: "Emitindo" },
  COMPLETO: { status: "ok", label: "Completo" },
  PARCIAL: { status: "err", label: "Emissão parcial" },
  FALHA: { status: "err", label: "Falha" },
  CANCELAMENTO_SOLICITADO: { status: "wait", label: "Cancelamento solicitado" },
};

export const DOC_LABEL = { NFSE: "NFS-e", NFE: "NF-e" } as const;

/** CPF/CNPJ mascarado para exibição. */
export const maskDocument = (s: string | null) => {
  const d = (s ?? "").replace(/[^0-9A-Za-z]/g, "");
  return d ? `${d.slice(0, 3)}•••••${d.slice(-2)}` : "—";
};
