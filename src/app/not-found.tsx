import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid justify-items-start gap-3 rounded-tile border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-bold">Página não encontrada</h1>
      <p className="text-muted">O endereço não existe ou o pedido foi informado errado.</p>
      <Link href="/" className="rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg">Ir para a visão geral</Link>
    </div>
  );
}
