import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser } from "@/auth/session";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL } from "@/domain/order-input";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DOC_BADGE, DOC_LABEL, ORDER_BADGE } from "./status";

export const metadata: Metadata = { title: "Pedidos" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";

// Filtros por situação: pedido antigo que precisa de ação não pode sumir da lista dos 50 mais recentes.
const FILTERS = {
  todos: { label: "Todos", where: {} },
  aguardando: { label: "Aguardando confirmação", where: { documents: { some: { state: { in: ["INCERTO", "ENVIADO"] } } } } },
  parciais: { label: "Parciais ou com falha", where: { state: { in: ["PARCIAL", "FALHA"] } } },
  bloqueados: { label: "Sem regra fiscal", where: { state: "BLOQUEADO" } },
  prontos: { label: "Prontos para emitir", where: { state: "PRONTO_REVISAO" } },
} satisfies Record<string, { label: string; where: Prisma.EmissionOrderWhereInput }>;
type FilterKey = keyof typeof FILTERS;

export default function Pedidos({ searchParams }: { searchParams: Promise<{ situacao?: string; q?: string }> }) {
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
        <Orders searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Orders({ searchParams }: { searchParams: Promise<{ situacao?: string; q?: string }> }) {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const sp = await searchParams;
  const key: FilterKey = sp.situacao && sp.situacao in FILTERS ? (sp.situacao as FilterKey) : "todos";
  const q = (sp.q ?? "").trim().slice(0, 60);
  // ponytail: 50 por filtro/busca, sem paginação; adicionar quando o volume pedir.
  const orders = await db.emissionOrder.findMany({
    where: { ...FILTERS[key].where, ...(q ? { customer: { name: { contains: q, mode: "insensitive" } } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { customer: { select: { name: true } }, documents: { select: { type: true, state: true }, orderBy: { type: "asc" } } },
  });
  const nav = (
    <>
    <form role="search" action="/pedidos" className="flex flex-wrap items-end gap-2">
      {key !== "todos" && <input type="hidden" name="situacao" value={key} />}
      <div className="grid gap-1.5">
        <label htmlFor="q" className="text-sm font-semibold">Buscar por cliente</label>
        <input id="q" name="q" defaultValue={q} placeholder="Nome do tomador" className="w-72 max-w-full rounded-xl border border-line bg-bg px-3 py-2.5 focus-visible:ring-2 focus-visible:ring-accent" />
      </div>
      <button type="submit" className="rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg">Buscar</button>
      {q && <Link href={key === "todos" ? "/pedidos" : `/pedidos?situacao=${key}`} className="px-2 py-2.5 text-sm text-muted hover:text-fg">Limpar</Link>}
    </form>
    <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
      {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
        <Link
          key={k}
          href={`/pedidos?${new URLSearchParams({ ...(k === "todos" ? {} : { situacao: k }), ...(q ? { q } : {}) })}`}
          aria-current={k === key ? "page" : undefined}
          className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-fg/5 aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg"
        >
          {FILTERS[k].label}
        </Link>
      ))}
    </nav>
    </>
  );
  if (orders.length === 0) {
    return (
      <>
        {nav}
        <div className={`${card} grid justify-items-start gap-2`}>
          <p className="font-semibold">{q ? `Nenhum pedido encontrado para “${q}”.` : key === "todos" ? "Nenhum pedido ainda." : "Nenhum pedido nesta situação."}</p>
          {key === "todos" && !q && <p className="text-sm text-muted">Cadastre o primeiro pedido para preparar as duas notas.</p>}
        </div>
      </>
    );
  }
  return (
    <>
    {nav}
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
    </>
  );
}
