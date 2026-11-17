import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2, CircleCheck, Clock, Scale } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Configuração fiscal" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function ConfiguracaoFiscal() {
  return (
    <div className="grid gap-3.5">
      <header className="reveal">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Configuração fiscal</h1>
        <p className="max-w-[70ch] text-muted">
          Cada nota só é emitida com uma regra aprovada pelo responsável fiscal e dentro da vigência. Sem regra, o pedido fica bloqueado.
        </p>
      </header>
      <Suspense fallback={<Skeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requireUser("FISCAL", "ADMIN");
  const [establishments, rules] = await Promise.all([
    db.establishment.findMany({ orderBy: { createdAt: "asc" } }),
    db.fiscalRule.findMany({ orderBy: [{ docType: "asc" }, { version: "desc" }], include: { establishment: { select: { name: true } } } }),
  ]);
  const now = new Date();

  return (
    <>
      <section className={card}>
        <h2 className="flex items-center gap-2 font-display font-semibold"><Building2 size={18} aria-hidden="true" /> Estabelecimentos</h2>
        {establishments.length === 0 ? (
          <Empty text="Nenhuma empresa emissora cadastrada. O cadastro exige CNPJ, UF, município, regime tributário e o certificado digital guardado em local seguro." />
        ) : (
          <ul className="mt-3 grid gap-2">
            {establishments.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <b>{e.name}</b>
                <span className="text-muted">{e.uf} · {e.regime}</span>
                <span className="text-muted">{e.environment === "PRODUCAO" ? "Produção" : "Homologação"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="flex items-center gap-2 font-display font-semibold"><Scale size={18} aria-hidden="true" /> Regras fiscais</h2>
        {rules.length === 0 ? (
          <Empty text="Nenhuma regra cadastrada. Todos os pedidos ficam bloqueados até o responsável fiscal cadastrar e aprovar as regras da NFS-e e da NF-e." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  {["Nota", "Finalidade", "Escopo", "Versão", "Vigência", "Situação"].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  const current = r.validFrom <= now && (!r.validTo || now < r.validTo);
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-line px-3 py-2.5 font-semibold">{r.docType === "NFSE" ? "NFS-e" : "NF-e"}</td>
                      <td className="border-b border-line px-3 py-2.5">{r.purpose}</td>
                      <td className="border-b border-line px-3 py-2.5 text-muted">{[r.ufDestino ?? "Todas as UFs", r.municipioIbge].filter(Boolean).join(" · ")}</td>
                      <td className="border-b border-line px-3 py-2.5 tabular-nums">v{r.version}</td>
                      <td className="whitespace-nowrap border-b border-line px-3 py-2.5 tabular-nums">{fmt(r.validFrom)} – {r.validTo ? fmt(r.validTo) : "sem fim"}</td>
                      <td className="border-b border-line px-3 py-2.5">
                        {!r.approvedAt ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wait"><Clock size={14} aria-hidden="true" /> Aguardando aprovação</span>
                        ) : !current ? (
                          <StatusBadge status="draft" />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ok"><CircleCheck size={14} aria-hidden="true" /> Aprovada e vigente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">
          Cadastro e aprovação de regras ficam disponíveis quando houver login com papéis: só o responsável fiscal aprova, com autoria, data, justificativa e vigência registradas.
        </p>
      </section>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">{text}</p>;
}

function Skeleton() {
  return (
    <div className="grid gap-3.5" aria-busy="true" aria-label="Carregando">
      {[0, 1].map((i) => <div key={i} className={`${card} h-32 animate-pulse motion-reduce:animate-none`} />)}
    </div>
  );
}
