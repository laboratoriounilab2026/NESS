"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { discardOrderAction, emitOrderAction, recheckRulesAction, reconcileOrderAction, retryRejectedAction, type ActionResult } from "./actions";

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";

type Props = { orderId: string; canEmit: boolean; uncertain: boolean; blocked: boolean; rejected: boolean; canRetry: boolean; canDiscard: boolean };

export function EmitPanel({ orderId, canEmit, uncertain, blocked, rejected, canRetry, canDiscard }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setResult(await fn());
      setConfirmed(false);
      setFixed(false);
      setDiscard(false);
      router.refresh();
    });

  if (!canEmit && !uncertain && !blocked && !rejected && !canDiscard) return null;
  return (
    <section className={`${card} grid justify-items-start gap-3`} aria-label="Emissão">
      {canEmit && (
        <>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Confirmo a emissão das notas pendentes. Nota autorizada só pode ser desfeita por cancelamento.
          </label>
          <button
            type="button"
            disabled={!confirmed || pending}
            onClick={() => run(() => emitOrderAction(orderId, confirmed))}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-accent-fg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <LoaderCircle size={18} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Send size={18} aria-hidden="true" />}
            Emitir notas
          </button>
        </>
      )}
      {blocked && (
        <>
          <p className="text-sm text-muted">Bloqueado por falta de regra fiscal aprovada e vigente. Se o responsável fiscal já aprovou, verifique de novo.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => recheckRulesAction(orderId))}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-fg/5 disabled:opacity-60"
          >
            <ShieldCheck size={16} aria-hidden="true" /> Verificar regras de novo
          </button>
        </>
      )}
      {uncertain && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reconcileOrderAction(orderId))}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-fg/5 disabled:opacity-60"
        >
          <RefreshCw size={16} aria-hidden="true" /> Consultar notas sem resposta
        </button>
      )}
      {rejected && !canRetry && <p className="text-sm text-muted">Nota rejeitada. Peça ao responsável fiscal para conferir o motivo e liberar nova tentativa.</p>}
      {rejected && canRetry && (
        <>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
            Conferi o motivo da rejeição e o que precisava ser corrigido já foi corrigido.
          </label>
          <button
            type="button"
            disabled={!fixed || pending}
            onClick={() => run(() => retryRejectedAction(orderId, fixed))}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw size={16} aria-hidden="true" /> Liberar nova tentativa
          </button>
        </>
      )}
      {canDiscard && (
        <details className="w-full border-t border-line pt-3 text-sm">
          <summary className="cursor-pointer text-muted">Pedido salvo por engano?</summary>
          <div className="mt-2 grid justify-items-start gap-2">
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={discard} onChange={(e) => setDiscard(e.target.checked)} />
              Descartar este pedido. Nenhuma nota foi enviada; ele fica no histórico e não poderá mais ser emitido.
            </label>
            <button
              type="button"
              disabled={!discard || pending}
              onClick={() => run(() => discardOrderAction(orderId, discard))}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-err hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} aria-hidden="true" /> Descartar pedido
            </button>
          </div>
        </details>
      )}
      <p role="status" className={`text-sm ${result && !result.ok ? "text-err" : "text-muted"}`}>
        {result?.message}
      </p>
    </section>
  );
}
