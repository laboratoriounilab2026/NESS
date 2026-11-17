"use client";

// Nunca mostra a mensagem técnica: pode conter dados internos. O detalhe fica no log do servidor.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-tile border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-bold">Não foi possível carregar esta tela</h1>
      <p className="text-muted">Pode ser falta de permissão para esta área ou falha no serviço de dados. Nenhuma nota foi emitida ou alterada.</p>
      <button type="button" onClick={reset} className="rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg">Tentar de novo</button>
    </div>
  );
}
