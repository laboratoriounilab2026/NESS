import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { DOC_BADGE, DOC_LABEL } from "../pedidos/status";

export const metadata: Metadata = { title: "Documentos" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";
const when = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function Documentos() {
  return (
    <div className="grid gap-3.5">
      <header className="reveal">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Documentos</h1>
        <p className="text-muted">Notas que o governo autorizou, com chave de acesso e protocolo. Só aparece aqui o que teve autorização confirmada.</p>
      </header>
      <Suspense fallback={<div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />}>
        <Docs />
      </Suspense>
    </div>
  );
}

async function Docs() {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  // Chave só é gravada após autorização confirmada pelo emissor (orchestrator/emit.ts).
  // ponytail: últimos 100; busca por chave/cliente e XML/DANFE quando os emissores reais existirem.
  const docs = await db.emissionDocument.findMany({
    where: { accessKey: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { order: { select: { customer: { select: { name: true } } } } },
  });
  if (docs.length === 0) {
    return (
      <div className={`${card} grid gap-1`}>
        <p className="font-semibold">Nenhuma nota autorizada ainda.</p>
        <p className="text-sm text-muted">Quando o governo autorizar uma NFS-e ou NF-e, ela aparece aqui com a chave de acesso.</p>
      </div>
    );
  }
  return (
    <section className={`${card} overflow-x-auto`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            {["Atualizada", "Nota", "Pedido", "Situação", "Chave de acesso", "Protocolo"].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">{when(d.updatedAt)}</td>
              <td className="border-b border-line px-3 py-2.5 font-semibold">{DOC_LABEL[d.type]}</td>
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
  );
}
