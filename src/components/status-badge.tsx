import { CircleCheck, LoaderCircle, Lock, PencilLine, TriangleAlert, type LucideIcon } from "lucide-react";

/** Status de um documento fiscal na interface. A fonte de verdade dos estados chega na Fase 1 (src/domain). */
export type DocStatus = "ok" | "wait" | "err" | "block" | "draft";

const MAP: Record<DocStatus, { label: string; Icon: LucideIcon; tone: string; spin?: boolean }> = {
  ok: { label: "Autorizada", Icon: CircleCheck, tone: "text-ok bg-ok/12 border-ok/25" },
  wait: { label: "Transmitindo", Icon: LoaderCircle, tone: "text-wait bg-wait/12 border-wait/25", spin: true },
  err: { label: "Rejeitada", Icon: TriangleAlert, tone: "text-err bg-err/12 border-err/25" },
  block: { label: "Sem regra fiscal", Icon: Lock, tone: "text-block bg-block/12 border-block/25" },
  draft: { label: "Rascunho", Icon: PencilLine, tone: "text-draft bg-draft/12 border-draft/25" },
};

// Sempre ícone + texto: a cor nunca é o único indicador (WCAG 1.4.1).
export function StatusBadge({ status, label: custom }: { status: DocStatus; label?: string }) {
  const { label: fallback, Icon, tone, spin } = MAP[status];
  const label = custom ?? fallback;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-0.5 pl-2 pr-2.5 text-[12.5px] font-semibold ${tone}`}>
      <Icon size={14} aria-hidden="true" className={spin ? "animate-spin" : undefined} />
      {label}
    </span>
  );
}
