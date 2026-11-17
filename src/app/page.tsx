import Link from "next/link";
import { Activity, ArrowRight, BadgeCheck, List, Plus, ShieldAlert, Split, TrendingUp } from "lucide-react";
import { Logo } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import { SAMPLE_ORDERS } from "@/lib/sample-data";

const tile = "reveal relative min-w-0 overflow-hidden rounded-tile border border-line bg-surface p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-24px_rgb(20_33_61/0.35)]";
const tileTitle = "flex items-center gap-2 font-display text-sm font-semibold text-muted";

export default function Dashboard() {
  return (
    <div className="grid gap-3.5">
      <p role="note" className="rounded-xl border border-dashed border-line px-4 py-2 text-sm text-muted">
        Dados de exemplo. Nenhuma nota real é exibida nesta fase.
      </p>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Hero: contexto operacional + CTA primário */}
        <section className={`${tile} flex flex-col justify-between gap-5 border-0 bg-ink text-ink-fg sm:col-span-2 xl:row-span-2`} style={{ ["--i" as string]: 0 }}>
          <span aria-hidden="true" className="orb pointer-events-none absolute -right-16 -top-16 size-64 rounded-full opacity-35 blur-[20px] [background:conic-gradient(var(--accent),transparent_40%,var(--accent)_70%,transparent)]" />
          <Logo size={40} className="relative" />
          <div className="relative grid gap-3">
            <h1 className="font-display text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.02] tracking-[-0.03em] text-balance">
              Serviço e álbum, <span className="text-accent">faturados juntos.</span>
            </h1>
            <p className="max-w-[40ch] text-ink-muted">3 pedidos prontos para emitir. Cada um gera NFS-e e NF-e de uma vez.</p>
          </div>
          <div className="relative flex flex-wrap gap-2.5">
            <Link href="/pedidos/novo" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-accent-fg transition hover:-translate-y-0.5">
              <Plus size={18} aria-hidden="true" /> Novo pedido
            </Link>
            <Link href="/rastreio" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-bold transition hover:bg-white/15">
              Rastreio
            </Link>
          </div>
        </section>

        <section className={tile} style={{ ["--i" as string]: 1 }}>
          <h3 className={tileTitle}><BadgeCheck size={18} aria-hidden="true" />Taxa de autorização</h3>
          <p className="mt-2 font-display text-[44px] font-bold tabular-nums tracking-tight">98%</p>
          <p className="text-[13px] text-muted">primeira tentativa, 30 dias</p>
        </section>

        <section className={tile} style={{ ["--i" as string]: 2 }}>
          <h3 className={tileTitle}><Activity size={18} aria-hidden="true" />Serviços</h3>
          <ul className="mt-3 grid gap-2.5 text-sm">
            {[["SEFAZ-SP", "ok"], ["Emissor Nacional", "ok"], ["SEFAZ-PR lenta", "block"]].map(([name, s]) => (
              <li key={name} className="flex items-center gap-2.5">
                <span className={`pulse-dot size-2.5 rounded-full ${s === "ok" ? "bg-ok" : "bg-block"}`} aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
        </section>

        <section className={tile} style={{ ["--i" as string]: 3 }}>
          <h3 className={tileTitle}><TrendingUp size={18} aria-hidden="true" />Notas na semana</h3>
          <p className="mt-2 font-display text-[32px] font-bold tabular-nums">126</p>
          <svg viewBox="0 0 200 70" preserveAspectRatio="none" className="mt-2 h-16 w-full" aria-hidden="true">
            <path d="M0 55 L28 48 L56 52 L84 30 L112 36 L140 20 L168 26 L200 8 L200 70 L0 70Z" className="fill-accent/20" />
            <path d="M0 55 L28 48 L56 52 L84 30 L112 36 L140 20 L168 26 L200 8" fill="none" className="stroke-accent" strokeWidth="2.5" />
          </svg>
        </section>

        <section className={`${tile} bg-[color-mix(in_srgb,var(--err)_8%,var(--surface))]`} style={{ ["--i" as string]: 4 }}>
          <h3 className={tileTitle}><Split size={18} aria-hidden="true" />Emissões parciais</h3>
          <p className="mt-2 font-display text-[44px] font-bold tabular-nums">2</p>
          <p className="text-[13px] text-muted">PED-2416: NF-e rejeitada (CEP).<br />PED-2417: NF-e transmitindo.</p>
        </section>

        <section className={`${tile} sm:col-span-2 xl:col-span-3`} style={{ ["--i" as string]: 5 }}>
          <h3 className={tileTitle}><List size={18} aria-hidden="true" />Pedidos recentes</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  {["Pedido", "Cliente", "Pacote", "Entrega", "NFS-e", "NF-e"].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-line px-3.5 py-2.5 font-semibold">{h}</th>
                  ))}
                  <th className="whitespace-nowrap border-b border-line px-3.5 py-2.5 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ORDERS.map((o) => (
                  <tr key={o.ref} className="transition-colors hover:bg-accent/8">
                    <td className="whitespace-nowrap border-b border-line px-3.5 py-3 font-semibold">{o.ref}</td>
                    <td className="whitespace-nowrap border-b border-line px-3.5 py-3">{o.customer}</td>
                    <td className="whitespace-nowrap border-b border-line px-3.5 py-3 text-muted">{o.pkg}</td>
                    <td className="whitespace-nowrap border-b border-line px-3.5 py-3 text-muted">{o.dest}</td>
                    <td className="border-b border-line px-3.5 py-3"><StatusBadge status={o.nfse} /></td>
                    <td className="border-b border-line px-3.5 py-3"><StatusBadge status={o.nfe} /></td>
                    <td className="whitespace-nowrap border-b border-line px-3.5 py-3 text-right">{o.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={tile} style={{ ["--i" as string]: 6 }}>
          <h3 className={tileTitle}><ShieldAlert size={18} aria-hidden="true" />Pendência fiscal</h3>
          <p className="mt-2.5">Entregas no <b>Paraná</b> ainda sem regra aprovada. Pedidos para lá ficam bloqueados.</p>
          <span className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold">Enviar ao contador <ArrowRight size={14} aria-hidden="true" /></span>
        </section>
      </div>
    </div>
  );
}
