"use client";

import Link from "next/link";

// Nunca mostra a mensagem técnica: pode conter dados internos. O detalhe fica no log do servidor (mesmo digest).
// Não afirma nada sobre notas: o erro pode ter acontecido no meio de uma emissão.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-tile border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-bold">Não foi possível concluir esta ação</h1>
      <p className="text-muted">Pode ser falta de permissão para esta área ou falha no serviço de dados.</p>
      <p>
        Se você estava emitindo, <b>não emita de novo</b>: abra o pedido e confira a situação de cada nota. Nota sem resposta aparece como
        “Aguardando confirmação” e deve ser consultada antes de qualquer reenvio.
      </p>
      {error.digest && <p className="text-sm text-muted">Código para o suporte: <span className="font-mono">{error.digest}</span></p>}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={reset} className="rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg">Tentar de novo</button>
        <Link href="/pedidos" className="rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-fg/5">Ver pedidos</Link>
      </div>
    </div>
  );
}
