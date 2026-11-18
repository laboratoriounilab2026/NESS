"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleCheck, LoaderCircle, Save, Trash2 } from "lucide-react";
import type { z } from "zod";
import { StatusBadge } from "@/components/status-badge";
import {
  customerSchema, EMPTY_DRAFT, formatBRL, goodsSchema, issuesByPath, parseBRL, recipientSchema, serviceSchema, UFS,
  type OrderDraft,
} from "@/domain/order-input";
import type { Resolution } from "@/fiscal/matrix";
import { checkOrder, saveOrder, type CheckResult } from "./actions";

type Section = keyof OrderDraft;
const STEPS: { label: string; section?: Section; schema?: z.ZodType }[] = [
  { label: "Tomador", section: "customer", schema: customerSchema },
  { label: "Destinatário", section: "recipient", schema: recipientSchema },
  { label: "Serviço", section: "service", schema: serviceSchema },
  { label: "Álbum", section: "goods", schema: goodsSchema },
  { label: "Verificação fiscal" },
  { label: "Revisão" },
  { label: "Confirmação" },
];

// sessionStorage: some ao fechar a aba (dados pessoais). ponytail: rascunho no servidor quando houver banco.
const DRAFT_KEY = "ness-draft-pedido";
const REF_KEY = "ness-draft-ref";

const inputCls = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-err";
const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";

const maskDoc = (s: string) => {
  const d = s.replace(/[^0-9A-Za-z]/g, "");
  return d ? `${d.slice(0, 3)}•••••${d.slice(-2)}` : "—";
};

export function OrderWizard() {
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaurar rascunho do navegador só é possível após montar
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft, loaded]);

  useEffect(() => {
    if (loaded) headingRef.current?.focus();
  }, [step, loaded]);

  function set<S extends Section>(section: S, key: keyof OrderDraft[S], value: unknown) {
    setDraft((d) => {
      const next = { ...d, [section]: { ...d[section], [key]: value } };
      // Destinatário "mesma pessoa" acompanha o tomador (o servidor também deriva; aqui é para a revisão mostrar certo).
      if (section === "customer" && (key === "name" || key === "document") && d.recipient.same) next.recipient = { ...next.recipient, [key]: value };
      return next;
    });
    setReviewed(false); // dado mudou: a conferência precisa ser refeita
    setErrors((e) => {
      const rest = { ...e };
      delete rest[`${section}.${String(key)}`];
      return rest;
    });
  }

  function go(to: number) {
    setStep(to);
    if (to === 4) {
      setCheck(null);
      startTransition(async () => {
        const res = await checkOrder(draft);
        if (!res.ok) {
          // Servidor discordou da validação do cliente: volta para a primeira etapa com erro.
          setErrors(res.errors);
          const first = STEPS.findIndex((s) => s.section && Object.keys(res.errors).some((k) => k.startsWith(`${s.section}.`)));
          setStep(first === -1 ? 0 : first);
        }
        setCheck(res);
      });
    }
  }

  function next() {
    const { section, schema } = STEPS[step];
    if (section && schema) {
      const r = schema.safeParse(draft[section]);
      if (!r.success) {
        const errs = issuesByPath(r.error);
        setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [`${section}.${k}`, v])));
        return;
      }
    }
    go(step + 1);
  }

  // Referência estável do rascunho: torna o salvamento idempotente (clique duplo não cria dois pedidos).
  function draftRef() {
    try {
      const r = sessionStorage.getItem(REF_KEY) ?? crypto.randomUUID();
      sessionStorage.setItem(REF_KEY, r);
      return r;
    } catch {
      return crypto.randomUUID();
    }
  }

  function save() {
    setSaveError(null);
    startTransition(async () => {
      const res = await saveOrder(draft, draftRef());
      if (!res.ok) {
        if (res.errors) setErrors(res.errors);
        setSaveError(res.message ?? "Revise os campos destacados.");
        return;
      }
      try {
        sessionStorage.removeItem(DRAFT_KEY);
        sessionStorage.removeItem(REF_KEY);
      } catch {}
      router.push(`/pedidos/${res.id}`);
    });
  }

  function discard() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(REF_KEY);
    } catch {}
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setCheck(null);
    setReviewed(false);
    setStep(0);
  }

  function field<S extends Section>(section: S, key: keyof OrderDraft[S] & string, label: string, opts: { hint?: string; inputMode?: "numeric" | "decimal" | "email"; disabled?: boolean; className?: string } = {}) {
    const id = `${section}-${key}`;
    const err = errors[`${section}.${key}`];
    return (
      <div className={`grid gap-1.5 ${opts.className ?? ""}`}>
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <input
          id={id}
          className={inputCls}
          value={String(draft[section][key] ?? "")}
          onChange={(e) => set(section, key, e.target.value)}
          inputMode={opts.inputMode}
          disabled={opts.disabled}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-err` : opts.hint ? `${id}-hint` : undefined}
        />
        {err ? (
          <p id={`${id}-err`} className="text-[13px] font-semibold text-err">{err}</p>
        ) : opts.hint ? (
          <p id={`${id}-hint`} className="text-[13px] text-muted">{opts.hint}</p>
        ) : null}
      </div>
    );
  }

  const fiscal = check?.ok ? check : null;
  const blocked = !fiscal || fiscal.nfse.status === "blocked" || fiscal.nfe.status === "blocked";
  const service = parseBRL(draft.service.value);
  const goods = parseBRL(draft.goods.unitValue) * (Number(draft.goods.quantity) || 0);

  return (
    <div className="grid gap-3.5 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Etapas do pedido" className={`${card} h-fit p-3 sm:p-3`}>
        <ol className="grid gap-0.5">
          {STEPS.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => i < step && go(i)}
                disabled={i >= step}
                aria-current={i === step ? "step" : undefined}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted transition-colors enabled:hover:bg-fg/5 aria-[current=step]:bg-fg/10 aria-[current=step]:font-semibold aria-[current=step]:text-fg"
              >
                <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums ${i < step ? "border-ok bg-ok/12 text-ok" : "border-line"}`}>
                  {i < step ? <CircleCheck size={14} aria-label="concluída" /> : i + 1}
                </span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 px-2.5 text-xs text-muted">Rascunho salvo nesta aba.</p>
      </nav>

      <section className={`${card} grid gap-5`} aria-labelledby="step-title">
        <h2 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold outline-none">
          <span className="text-muted">Etapa {step + 1} de 7 · </span>{STEPS[step].label}
        </h2>

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-muted sm:col-span-2">Quem contratou e paga o serviço. Aparece na NFS-e.</p>
            {field("customer", "document", "CPF ou CNPJ", { hint: "Aceita CNPJ alfanumérico." })}
            {field("customer", "name", "Nome ou razão social")}
            {field("customer", "email", "E-mail (opcional)", { inputMode: "email", hint: "Para enviar a nota ao cliente." })}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-muted sm:col-span-2">Quem recebe o álbum. Aparece na NF-e e na etiqueta de envio.</p>
            <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={draft.recipient.same}
                onChange={(e) => {
                  const same = e.target.checked;
                  setDraft((d) => ({ ...d, recipient: { ...d.recipient, same, ...(same ? { name: d.customer.name, document: d.customer.document } : {}) } }));
                }}
              />
              O destinatário é o próprio tomador
            </label>
            {field("recipient", "name", "Nome de quem recebe", { disabled: draft.recipient.same })}
            {field("recipient", "document", "CPF ou CNPJ (opcional)", { disabled: draft.recipient.same })}
            {field("recipient", "cep", "CEP", { inputMode: "numeric" })}
            {field("recipient", "street", "Rua")}
            {field("recipient", "number", "Número")}
            {field("recipient", "district", "Bairro")}
            {field("recipient", "city", "Cidade")}
            <div className="grid gap-1.5">
              <label htmlFor="recipient-uf" className="text-sm font-semibold">UF</label>
              <select
                id="recipient-uf"
                className={inputCls}
                value={draft.recipient.uf}
                onChange={(e) => set("recipient", "uf", e.target.value)}
                aria-invalid={errors["recipient.uf"] ? true : undefined}
                aria-describedby={errors["recipient.uf"] ? "recipient-uf-err" : undefined}
              >
                <option value="">Selecione</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
              {errors["recipient.uf"] && <p id="recipient-uf-err" className="text-[13px] font-semibold text-err">{errors["recipient.uf"]}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-muted sm:col-span-2">O serviço fotográfico. Vira a NFS-e. Códigos e impostos vêm da regra aprovada.</p>
            {field("service", "description", "Descrição do serviço", { className: "sm:col-span-2", hint: "Ex.: Ensaio gestante, 2 horas, 40 fotos editadas." })}
            {field("service", "value", "Valor do serviço (R$)", { inputMode: "decimal", hint: "Ex.: 1.250,00" })}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-muted sm:col-span-2">O álbum ou mercadoria enviada. Vira a NF-e. NCM, CFOP e tributação vêm da regra aprovada.</p>
            {field("goods", "description", "Descrição do álbum", { className: "sm:col-span-2", hint: "Ex.: Álbum 30×30, capa em linho, 40 páginas." })}
            {field("goods", "quantity", "Quantidade", { inputMode: "numeric" })}
            {field("goods", "unitValue", "Valor unitário (R$)", { inputMode: "decimal" })}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-3.5" aria-live="polite" aria-busy={pending}>
            <p className="text-sm text-muted">O servidor confere os dados e procura uma regra fiscal aprovada e vigente para cada nota.</p>
            {pending || !fiscal ? (
              <p className="inline-flex items-center gap-2 text-muted"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Verificando…</p>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                <RuleCard title="NFS-e · serviço" r={fiscal.nfse} />
                <RuleCard title="NF-e · álbum" r={fiscal.nfe} />
              </div>
            )}
            {fiscal && blocked && (
              <p role="note" className="rounded-xl border border-dashed border-line px-4 py-3 text-sm">
                Este pedido não pode ser emitido até o responsável fiscal aprovar a regra que falta. O rascunho continua salvo.
                Você pode revisar o pedido, mas a emissão fica bloqueada.
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <ReviewCard title="NFS-e · serviço" status={fiscal?.nfse} rows={[
              ["Tomador", draft.customer.name],
              ["CPF/CNPJ", maskDoc(draft.customer.document)],
              ["Serviço", draft.service.description],
              ["Valor", formatBRL(service)],
            ]} />
            <ReviewCard title="NF-e · álbum" status={fiscal?.nfe} rows={[
              ["Destinatário", draft.recipient.name],
              ["Entrega", `${draft.recipient.city}/${draft.recipient.uf} · CEP ${draft.recipient.cep}`],
              ["Item", `${draft.goods.quantity} × ${draft.goods.description}`],
              ["Valor", formatBRL(goods)],
            ]} />
          </div>
        )}

        {step === 6 && (
          <div className="grid justify-items-start gap-4">
            <p>Total do pedido: <b className="tabular-nums">{formatBRL(service + goods)}</b> ({formatBRL(service)} serviço + {formatBRL(goods)} álbum)</p>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
              Conferi os dados das duas notas
            </label>
            <button type="button" onClick={save} disabled={!reviewed || pending} className="inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-3 font-bold text-bg disabled:cursor-not-allowed disabled:opacity-60">
              {pending ? <LoaderCircle size={18} aria-hidden="true" className="animate-spin" /> : <Save size={18} aria-hidden="true" />} Salvar pedido
            </button>
            {saveError && <p role="alert" className="text-sm text-err">{saveError}</p>}
            <p className="text-sm text-muted">
              {blocked
                ? "O pedido será salvo como bloqueado: falta regra fiscal aprovada."
                : "Depois de salvar, a emissão é feita na página do pedido, com confirmação."}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold hover:bg-fg/5">
              <ArrowLeft size={18} aria-hidden="true" /> Voltar
            </button>
          )}
          {step < 6 && (
            <button type="button" onClick={next} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg disabled:opacity-60">
              Continuar <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={discard} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-fg/5 hover:text-fg">
            <Trash2 size={16} aria-hidden="true" /> Descartar rascunho
          </button>
        </div>
      </section>
    </div>
  );
}

// Regra encontrada ≠ nota autorizada: nunca usar o selo "Autorizada" aqui.
function RuleBadge({ r }: { r?: Resolution }) {
  if (!r) return null;
  if (r.status === "blocked") return <StatusBadge status="block" />;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/12 py-0.5 pl-2 pr-2.5 text-[12.5px] font-semibold text-ok">
      <CircleCheck size={14} aria-hidden="true" /> Regra aprovada v{r.version}
    </span>
  );
}

function RuleCard({ title, r }: { title: string; r: Resolution }) {
  return (
    <div className="grid content-start gap-2 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2"><b>{title}</b><RuleBadge r={r} /></div>
      <p className="text-sm text-muted">{r.status === "blocked" ? r.reason : "Parâmetros fiscais definidos pela regra aprovada."}</p>
    </div>
  );
}

function ReviewCard({ title, status, rows }: { title: string; status?: Resolution; rows: [string, string][] }) {
  return (
    <div className="grid content-start gap-3 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2"><b>{title}</b><RuleBadge r={status} /></div>
      <dl className="grid gap-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
