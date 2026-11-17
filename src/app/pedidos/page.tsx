import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser } from "@/auth/session";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL } from "@/domain/order-input";
import { db } from "@/lib/db";
import { DOC_BADGE, DOC_LABEL, ORDER_BADGE } from "./status";

export const metadata: Metadata = { title: "Pedidos" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";

export default function Pedidos() {
  return (
    <div className="grid gap-3.5">
      <header className="reveal flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Pedidos</h1>
          <p className="text-muted">Cada pedido gera duas notas: NFS-e do serviço e NF-e do álbum, com status independentes.</p>
        </div>
        <Link href="/pedidos/novo" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-bold text-accent-fg">
          <Plus size={18} aria-hidden="true" /> Novo pedido
        </Link>
      </header>
      <Suspense fallback={<div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />}>
        <Orders />
      </Suspense>
    </div>
  );
}

async function Orders() {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  // ponytail: últimos 50, sem paginação/busca; adicionar quando o volume pedir.
  const orders = await db.emissionOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { customer: { select: { name: true } }, documents: { select: { type: true, state: true }, orderBy: { type: "asc" } } },
  });
  if (orders.length === 0) {
    return (
      <div className={`${card} grid justify-items-start gap-2`}>
        <p className="font-semibold">Nenhum pedido ainda.</p>
        <p className="text-sm text-muted">Cadastre o primeiro pedido para preparar as duas notas.</p>
      </div>
    );
  }
  return (
    <section className={`${card} overflow-x-auto`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            {["Criado em", "Tomador", "Total", "Pedido", "Notas"].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-fg/5">
              <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">
                <Link href={`/pedidos/${o.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {o.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                </Link>
              </td>
              <td className="border-b border-line px-3 py-2.5">{o.customer.name}</td>
              <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">{formatBRL(o.serviceCents + o.goodsCents)}</td>
              <td className="border-b border-line px-3 py-2.5"><StatusBadge {...ORDER_BADGE[o.state]} /></td>
              <td className="border-b border-line px-3 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {o.documents.map((d) => (
                    <span key={d.type} className="inline-flex items-center gap-1 text-xs">
                      <b>{DOC_LABEL[d.type]}</b> <StatusBadge {...DOC_BADGE[d.state]} />
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
