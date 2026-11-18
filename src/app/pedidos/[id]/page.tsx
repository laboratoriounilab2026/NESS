import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/auth/session";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL } from "@/domain/order-input";
import { db } from "@/lib/db";
import type { RecipientEdit } from "./actions";
import { EmitPanel } from "./emit-panel";
import { RecipientEditor } from "./recipient-editor";
import { DOC_BADGE, DOC_LABEL, maskDocument, ORDER_BADGE } from "../status";

export const metadata: Metadata = { title: "Pedido" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";

// responseSummary guarda só { kind, code, message } do emissor (sem dados pessoais).
function govReason(summary: unknown): string {
  const s = summary as { code?: unknown; message?: unknown } | null;
  return s && typeof s.code === "string" && typeof s.message === "string" ? `${s.code} — ${s.message}` : "não informado";
}

export default function Pedido({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="grid gap-3.5">
      <Link href="/pedidos" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden="true" /> Pedidos
      </Link>
      <Suspense fallback={<div className={`${card} h-64 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const { id } = await params;
  const o = await db.emissionOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      recipient: true,
      documents: { orderBy: { type: "asc" }, include: {
          fiscalRule: { select: { version: true } },
          _count: { select: { attempts: true } },
          // ponytail: últimas 10 tentativas por nota; a lista completa está em Emissões.
          attempts: { orderBy: { seq: "desc" }, take: 10, select: { id: true, seq: true, startedAt: true, resultState: true, responseSummary: true } },
        },
      },
    },
  });
  if (!o) notFound();
  const r = o.recipient;
  return (
    <>
      <header className="reveal flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[clamp(24px,2.6vw,32px)] font-bold tracking-[-0.02em]">Pedido de {o.customer.name}</h1>
        <StatusBadge {...ORDER_BADGE[o.state]} />
      </header>

      <div className="grid gap-3.5 md:grid-cols-2">
        {o.documents.map((d) => (
          <section key={d.id} className={`${card} grid gap-2`} aria-label={DOC_LABEL[d.type]}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{DOC_LABEL[d.type]} · {d.type === "NFSE" ? "serviço" : "álbum"}</h2>
              <StatusBadge {...DOC_BADGE[d.state]} />
            </div>
            <p className="tabular-nums">{formatBRL(d.type === "NFSE" ? o.serviceCents : o.goodsCents)}</p>
            <p className="text-sm text-muted">
              {d.fiscalRule ? `Regra fiscal versão ${d.fiscalRule.version}` : "Sem regra fiscal aprovada: emissão bloqueada até o responsável fiscal aprovar."}
            </p>
            {d._count.attempts === 0 ? (
              <p className="text-sm text-muted">Nenhuma tentativa de envio.</p>
            ) : (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Tentativas de envio: {d._count.attempts}</summary>
                <ol className="mt-2 grid gap-1.5">
                  {d.attempts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="tabular-nums text-muted">{a.seq}ª · {a.startedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>
                      {a.resultState ? <StatusBadge {...DOC_BADGE[a.resultState]} /> : <StatusBadge status="wait" label="Sem resposta" />}
                      {(a.resultState === "REJEITADO" || a.resultState === "DENEGADO") && <span className="text-muted">{govReason(a.responseSummary)}</span>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {(d.state === "REJEITADO" || d.state === "DENEGADO") && (
              <p className="text-sm text-err">Motivo informado pelo governo: {govReason(d.attempts[0]?.responseSummary)}</p>
            )}
            {d.accessKey &&<p className="break-all font-mono text-xs">Chave: {d.accessKey}</p>}
          </section>
        ))}
      </div>

      <section className={`${card} grid gap-1 text-sm sm:grid-cols-2`}>
        <p><b>Tomador:</b> {o.customer.name} · {maskDocument(o.customer.document)}</p>
        {r && <p><b>Entrega:</b> {r.name} · {r.city}/{r.uf} · CEP {r.cep}</p>}
      </section>

      {r && o.state !== "DESCARTADO" && o.documents.some((d) => d.type === "NFE" && (d.state === "PENDENTE" || d.state === "REJEITADO")) && (
        <RecipientEditor
          orderId={o.id}
          initial={{
            name: r.name, document: r.document ?? "", cep: r.cep, street: r.street, number: r.number, district: r.district, city: r.city,
            uf: r.uf as RecipientEdit["uf"],
          }}
        />
      )}

      <EmitPanel
        orderId={o.id}
        canEmit={(o.state === "PRONTO_REVISAO" || o.state === "EMITINDO") && o.documents.some((d) => d.state === "PENDENTE")}
        uncertain={o.documents.some((d) => d.state === "INCERTO" || d.state === "ENVIADO")}
        blocked={o.state === "BLOQUEADO"}
        rejected={o.documents.some((d) => d.state === "REJEITADO")}
        canRetry={user.role === "FISCAL" || user.role === "ADMIN"}
        canDiscard={(o.state === "PRONTO_REVISAO" || o.state === "BLOQUEADO") && o.documents.every((d) => d.state === "PENDENTE" && d._count.attempts === 0)}
      />
    </>
  );
}
