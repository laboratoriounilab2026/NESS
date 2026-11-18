"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, Send } from "lucide-react";
import { emitOrderAction, reconcileOrderAction, type ActionResult } from "./actions";

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";

export function EmitPanel({ orderId, canEmit, uncertain }: { orderId: string; canEmit: boolean; uncertain: boolean }) {
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setResult(await fn());
      setConfirmed(false);
      router.refresh();
    });

  if (!canEmit && !uncertain) return null;
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
      <p role="status" className={`text-sm ${result && !result.ok ? "text-err" : "text-muted"}`}>
        {result?.message}
      </p>
    </section>
  );
}
