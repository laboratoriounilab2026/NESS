import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Auditoria" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";

export default function Auditoria() {
  return (
    <div className="grid gap-3.5">
      <header className="reveal">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Auditoria</h1>
        <p className="text-muted">Quem fez o quê, quando e com qual resultado. Os registros não podem ser alterados.</p>
      </header>
      <Suspense fallback={<div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />}>
        <Events />
      </Suspense>
    </div>
  );
}

async function Events() {
  // ponytail: últimos 100, sem paginação; adicionar filtros/paginação quando o volume pedir.
  const events = await db.auditEvent.findMany({ orderBy: { at: "desc" }, take: 100 });
  if (events.length === 0) {
    return <p className={`${card} text-sm text-muted`}>Nenhum evento registrado ainda.</p>;
  }
  return (
    <section className={`${card} overflow-x-auto`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            {["Quando", "Quem", "Ação", "Resultado", "Correlação"].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">{e.at.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
              <td className="border-b border-line px-3 py-2.5">{e.actor}</td>
              <td className="border-b border-line px-3 py-2.5 font-mono text-[12.5px]">{e.action}</td>
              <td className="border-b border-line px-3 py-2.5">{e.result}</td>
              <td className="border-b border-line px-3 py-2.5 font-mono text-[12px] text-muted">{e.correlationId.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
