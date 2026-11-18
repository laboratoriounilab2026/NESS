import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { StatusBadge } from "@/components/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DOC_BADGE, DOC_LABEL } from "../pedidos/status";

export const metadata: Metadata = { title: "Documentos" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";
const when = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function Documentos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <div className="grid gap-3.5">
      <header className="reveal">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Documentos</h1>
        <p className="text-muted">Notas que o governo autorizou, com chave de acesso e protocolo. Só aparece aqui o que teve autorização confirmada.</p>
      </header>
      <Suspense fallback={<div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />}>
        <Docs searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Docs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const digits = /^\d+$/.test(q) ? q : null;
  // Número que cabe na coluna = número da nota; número maior = início da chave de acesso; texto = nome do cliente.
  const search: Prisma.EmissionDocumentWhereInput = !q
    ? {}
    : digits && Number(digits) <= 2_147_483_647 // cabe na coluna de número; acima disso só pode ser chave
      ? { OR: [{ nfeNumber: { number: Number(digits) } }, { dpsNumber: { number: Number(digits) } }] }
      : digits
        ? { accessKey: { startsWith: digits } }
        : { order: { customer: { name: { contains: q, mode: "insensitive" } } } };
  // Chave só é gravada após autorização confirmada pelo emissor (orchestrator/emit.ts).
  // ponytail: 100 por busca; XML/DANFE quando os emissores reais existirem.
  const docs = await db.emissionDocument.findMany({
    where: { accessKey: { not: null }, ...search },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      order: { select: { customer: { select: { name: true } } } },
      nfeNumber: { select: { series: true, number: true } },
      dpsNumber: { select: { series: true, number: true } },
    },
  });
  const form = (
    <form role="search" action="/documentos" className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <label htmlFor="q" className="text-sm font-semibold">Buscar nota</label>
        <input id="q" name="q" defaultValue={q} placeholder="Número, chave ou cliente" className="w-72 max-w-full rounded-xl border border-line bg-bg px-3 py-2.5 focus-visible:ring-2 focus-visible:ring-accent" />
      </div>
      <button type="submit" className="rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg">Buscar</button>
      {q && <a href="/documentos" className="px-2 py-2.5 text-sm text-muted hover:text-fg">Limpar</a>}
    </form>
  );
  const thisMonth = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const exportForm = (
    <form action="/documentos/exportar" method="get" className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <label htmlFor="mes" className="text-sm font-semibold">Exportar para o contador</label>
        <input id="mes" name="mes" type="month" required defaultValue={thisMonth} className="rounded-xl border border-line bg-bg px-3 py-2 focus-visible:ring-2 focus-visible:ring-accent" />
      </div>
      <button type="submit" className="rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-fg/5">Baixar CSV do mês</button>
    </form>
  );
  if (docs.length === 0 && q) {
    return (
      <>
        {form}
        <p className={`${card} text-sm text-muted`}>Nenhuma nota autorizada encontrada para “{q}”.</p>
      </>
    );
  }
  if (docs.length === 0) {
    return (
      <div className={`${card} grid gap-1`}>
        <p className="font-semibold">Nenhuma nota autorizada ainda.</p>
        <p className="text-sm text-muted">Quando o governo autorizar uma NFS-e ou NF-e, ela aparece aqui com a chave de acesso.</p>
      </div>
    );
  }
  return (
    <>
    <div className="flex flex-wrap items-end justify-between gap-3">{form}{exportForm}</div>
    <section className={`${card} overflow-x-auto`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            {["Atualizada", "Nota", "Número / série", "Pedido", "Situação", "Chave de acesso", "Protocolo"].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">{when(d.updatedAt)}</td>
              <td className="border-b border-line px-3 py-2.5 font-semibold">{DOC_LABEL[d.type]}</td>
              <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">
                {(() => {
                  const n = d.nfeNumber ?? d.dpsNumber;
                  return n ? `${n.number} / ${n.series}` : "—";
                })()}
              </td>
              <td className="border-b border-line px-3 py-2.5">
                <Link href={`/pedidos/${d.orderId}`} className="hover:underline">{d.order.customer.name}</Link>
              </td>
              <td className="border-b border-line px-3 py-2.5"><StatusBadge {...DOC_BADGE[d.state]} /></td>
              <td className="break-all border-b border-line px-3 py-2.5 font-mono text-[12px]">{d.accessKey}</td>
              <td className="border-b border-line px-3 py-2.5 font-mono text-[12px] text-muted">{d.protocol ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
    </>
  );
}
