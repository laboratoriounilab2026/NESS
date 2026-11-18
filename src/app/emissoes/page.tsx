import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { DOC_BADGE, DOC_LABEL } from "../pedidos/status";

export const metadata: Metadata = { title: "Emissões" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";
const when = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });

export default function Emissoes() {
  return (
    <div className="grid gap-3.5">
      <header className="reveal">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Emissões</h1>
        <p className="text-muted">Cada tentativa de envio ao governo, com a resposta recebida. Sem resposta, a nota fica aguardando confirmação e não é reenviada.</p>
      </header>
      <Suspense fallback={<div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />}>
        <Attempts />
      </Suspense>
    </div>
  );
}

async function Attempts() {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  // ponytail: últimas 100, sem filtro; filtrar por estado/período quando o volume pedir.
  const attempts = await db.emissionAttempt.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { document: { select: { type: true, orderId: true, order: { select: { customer: { select: { name: true } } } } } } },
  });
  if (attempts.length === 0) {
    return (
      <div className={`${card} grid gap-1`}>
        <p className="font-semibold">Nenhuma emissão ainda.</p>
        <p className="text-sm text-muted">A transmissão ao governo entra primeiro em homologação. Até lá, os pedidos ficam com as notas pendentes.</p>
      </div>
    );
  }
  return (
    <section className={`${card} overflow-x-auto`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            {["Início", "Nota", "Pedido", "Tentativa", "Resultado", "Correlação"].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">{when(a.startedAt)}</td>
              <td className="border-b border-line px-3 py-2.5 font-semibold">{DOC_LABEL[a.document.type]}</td>
              <td className="border-b border-line px-3 py-2.5">
                <Link href={`/pedidos/${a.document.orderId}`} className="hover:underline">{a.document.order.customer.name}</Link>
              </td>
              <td className="border-b border-line px-3 py-2.5 tabular-nums">{a.seq}ª</td>
              <td className="border-b border-line px-3 py-2.5">
                {a.resultState ? <StatusBadge {...DOC_BADGE[a.resultState]} /> : <StatusBadge status="wait" label="Sem resposta" />}
              </td>
              <td className="border-b border-line px-3 py-2.5 font-mono text-[12px] text-muted">{a.correlationId.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
