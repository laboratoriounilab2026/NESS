import Link from "next/link";
import { cache, Suspense } from "react";
import { ArrowRight, BadgeCheck, List, Plus, ShieldAlert, Split, Timer } from "lucide-react";
import { requireUser } from "@/auth/session";
import { Logo } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL } from "@/domain/order-input";
import { db } from "@/lib/db";
import { DOC_BADGE, DOC_LABEL } from "./pedidos/status";

const tile = "reveal relative min-w-0 overflow-hidden rounded-tile border border-line bg-surface p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-24px_rgb(20_33_61/0.35)]";
const tileTitle = "flex items-center gap-2 font-display text-sm font-semibold text-muted";
const skeleton = (h: string) => <div className={`${tile} ${h} animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />;

export default function Dashboard() {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {/* Hero: contexto operacional + CTA primário */}
      <section className={`${tile} flex flex-col justify-between gap-5 border-0 bg-ink text-ink-fg sm:col-span-2 xl:row-span-2`} style={{ ["--i" as string]: 0 }}>
        <span aria-hidden="true" className="orb pointer-events-none absolute -right-16 -top-16 size-64 rounded-full opacity-35 blur-[20px] [background:conic-gradient(var(--accent),transparent_40%,var(--accent)_70%,transparent)]" />
        <Logo size={40} className="relative" />
        <div className="relative grid gap-3">
          <h1 className="font-display text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.02] tracking-[-0.03em] text-balance">
            Serviço e álbum, <span className="text-accent">faturados juntos.</span>
          </h1>
          <Suspense fallback={<p className="text-ink-muted">Carregando resumo…</p>}>
            <HeroSummary />
          </Suspense>
        </div>
        <div className="relative flex flex-wrap gap-2.5">
          <Link href="/pedidos/novo" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-accent-fg transition hover:-translate-y-0.5">
            <Plus size={18} aria-hidden="true" /> Novo pedido
          </Link>
          <Link href="/pedidos" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-bold transition hover:bg-white/15">
            Ver pedidos
          </Link>
        </div>
      </section>

      <Suspense fallback={<>{skeleton("h-36")}{skeleton("h-36")}{skeleton("h-36")}{skeleton("h-36")}</>}>
        <Counters />
      </Suspense>

      <Suspense fallback={<div className="sm:col-span-2 xl:col-span-4">{skeleton("h-48")}</div>}>
        <Recent />
      </Suspense>
    </div>
  );
}

// cache: hero e contadores usam a mesma consulta por requisição.
const counts = cache(async () => {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const [byState, authorized, uncertain] = await Promise.all([
    db.emissionOrder.groupBy({ by: ["state"], _count: true }),
    db.emissionDocument.count({ where: { state: "AUTORIZADO" } }),
    db.emissionDocument.count({ where: { state: { in: ["INCERTO", "ENVIADO"] } } }),
  ]);
  const of = (s: string) => byState.find((r) => r.state === s)?._count ?? 0;
  return { ready: of("PRONTO_REVISAO"), blocked: of("BLOQUEADO"), partial: of("PARCIAL"), authorized, uncertain };
});

async function HeroSummary() {
  const c = await counts();
  const n = c.ready;
  return (
    <p className="max-w-[40ch] text-ink-muted">
      {n === 0 ? "Nenhum pedido pronto para emitir." : `${n} ${n === 1 ? "pedido pronto" : "pedidos prontos"} para emitir.`} Cada um gera NFS-e e NF-e.
    </p>
  );
}

async function Counters() {
  const c = await counts();
  return (
    <>
      <section className={tile} style={{ ["--i" as string]: 1 }}>
        <h2 className={tileTitle}><BadgeCheck size={18} aria-hidden="true" />Notas autorizadas</h2>
        <p className="mt-2 font-display text-[44px] font-bold tabular-nums tracking-tight">{c.authorized}</p>
        <p className="text-[13px] text-muted">confirmadas pelo governo</p>
      </section>

      <section className={tile} style={{ ["--i" as string]: 2 }}>
        <h2 className={tileTitle}><Timer size={18} aria-hidden="true" />Aguardando confirmação</h2>
        <p className="mt-2 font-display text-[44px] font-bold tabular-nums">{c.uncertain}</p>
        <p className="text-[13px] text-muted">enviadas sem resposta final; consultar antes de reenviar</p>
      </section>

      <section className={`${tile} ${c.partial ? "bg-[color-mix(in_srgb,var(--err)_8%,var(--surface))]" : ""}`} style={{ ["--i" as string]: 3 }}>
        <h2 className={tileTitle}><Split size={18} aria-hidden="true" />Emissões parciais</h2>
        <p className="mt-2 font-display text-[44px] font-bold tabular-nums">{c.partial}</p>
        <p className="text-[13px] text-muted">uma nota autorizada e a outra não</p>
      </section>

      <section className={tile} style={{ ["--i" as string]: 4 }}>
        <h2 className={tileTitle}><ShieldAlert size={18} aria-hidden="true" />Pendência fiscal</h2>
        <p className="mt-2 font-display text-[44px] font-bold tabular-nums">{c.blocked}</p>
        <p className="text-[13px] text-muted">{c.blocked === 1 ? "pedido bloqueado" : "pedidos bloqueados"} por falta de regra aprovada</p>
        {c.blocked > 0 && (
          <Link href="/configuracao-fiscal" className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold">
            Configuração fiscal <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </section>
    </>
  );
}

async function Recent() {
  await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const orders = await db.emissionOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { customer: { select: { name: true } }, recipient: { select: { city: true, uf: true } }, documents: { select: { type: true, state: true } } },
  });
  return (
    <section className={`${tile} sm:col-span-2 xl:col-span-4`} style={{ ["--i" as string]: 5 }}>
      <h2 className={tileTitle}><List size={18} aria-hidden="true" />Pedidos recentes</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhum pedido ainda. Comece por <Link href="/pedidos/novo" className="font-semibold underline">Novo pedido</Link>.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                {["Cliente", "Entrega", "NFS-e", "NF-e"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-line px-3.5 py-2.5 font-semibold">{h}</th>
                ))}
                <th className="whitespace-nowrap border-b border-line px-3.5 py-2.5 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-accent/8">
                  <td className="whitespace-nowrap border-b border-line px-3.5 py-3 font-semibold">
                    <Link href={`/pedidos/${o.id}`} className="hover:underline">{o.customer.name}</Link>
                  </td>
                  <td className="whitespace-nowrap border-b border-line px-3.5 py-3 text-muted">{o.recipient ? `${o.recipient.city}/${o.recipient.uf}` : "—"}</td>
                  {(["NFSE", "NFE"] as const).map((t) => {
                    const d = o.documents.find((x) => x.type === t);
                    return (
                      <td key={t} className="border-b border-line px-3.5 py-3" aria-label={DOC_LABEL[t]}>
                        {d ? <StatusBadge {...DOC_BADGE[d.state]} /> : "—"}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap border-b border-line px-3.5 py-3 text-right">{formatBRL(o.serviceCents + o.goodsCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
