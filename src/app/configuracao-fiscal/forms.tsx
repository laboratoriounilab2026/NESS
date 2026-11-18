"use client";

import { startTransition, useActionState, useState } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { UFS } from "@/domain/order-input";
import { NFE_FIELDS, NFSE_FIELDS, REGIMES, RETENCAO_ISS } from "@/fiscal/rule-input";
import { approveRule, configureNfeNumbering, createEstablishment, createRule, type FormState } from "./actions";

const inputCls = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-err";
const btn = "inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg disabled:opacity-60";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {error ? <p id={`${id}-err`} className="text-[13px] font-semibold text-err">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state.ok) return <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok"><CircleCheck size={16} aria-hidden="true" />{state.ok}</p>;
  if (state.errors?._) return <p role="alert" className="text-sm font-semibold text-err">{state.errors._}</p>;
  if (state.errors) return <p role="alert" className="text-sm font-semibold text-err">Corrija os campos destacados.</p>;
  return null;
}

const inputProps = (id: string, errors?: Record<string, string>) => ({
  id, name: id, className: inputCls,
  "aria-invalid": errors?.[id] ? true : undefined,
  "aria-describedby": errors?.[id] ? `${id}-err` : undefined,
});

export function EstablishmentForm() {
  const [state, action, pending] = useActionState(
    (prev: FormState, f: FormData) => createEstablishment(prev, Object.fromEntries(f)),
    {},
  );
  const e = state.errors;
  return (
    <form onSubmit={keep(action)} className="mt-3 grid gap-4 sm:grid-cols-2">
      <Field id="cnpj" label="CNPJ" error={e?.cnpj}><input {...inputProps("cnpj", e)} /></Field>
      <Field id="name" label="Razão social" error={e?.name}><input {...inputProps("name", e)} /></Field>
      <Field id="uf" label="UF" error={e?.uf}>
        <select {...inputProps("uf", e)} defaultValue=""><option value="">Selecione</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
      </Field>
      <Field id="municipioIbge" label="Código IBGE do município" error={e?.municipioIbge} hint="7 dígitos, consulte o IBGE.">
        <input {...inputProps("municipioIbge", e)} inputMode="numeric" />
      </Field>
      <Field id="regime" label="Regime tributário (CRT)" error={e?.regime}>
        <select {...inputProps("regime", e)} defaultValue=""><option value="">Selecione</option>{Object.entries(REGIMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={btn}><Plus size={18} aria-hidden="true" /> Cadastrar em homologação</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RuleForm() {
  const [docType, setDocType] = useState<"NFE" | "NFSE">("NFE");
  const [state, action, pending] = useActionState((prev: FormState, f: FormData) => {
    const fields = docType === "NFE" ? NFE_FIELDS : NFSE_FIELDS;
    return createRule(prev, {
      docType,
      purpose: docType === "NFE" ? "album" : "servico-fotografico",
      ufDestino: f.get("ufDestino") ?? "",
      municipioIbge: "", // ponytail: regra por município desativada até a decisão fiscal (docs/ARQUITETURA.md)
      validFrom: f.get("validFrom"),
      validTo: f.get("validTo"),
      justification: f.get("justification"),
      params: Object.fromEntries(fields.map((x) => [x.key, f.get(`p_${x.key}`) ?? ""])),
    });
  }, {});
  const e = state.errors;
  const fields = docType === "NFE" ? NFE_FIELDS : NFSE_FIELDS;

  return (
    <form onSubmit={keep(action)} className="mt-3 grid gap-4">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1.5 text-sm font-semibold">Nota</legend>
        {(["NFE", "NFSE"] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <input type="radio" name="docType" checked={docType === t} onChange={() => setDocType(t)} className="accent-[var(--accent)]" />
            {t === "NFE" ? "NF-e · álbum" : "NFS-e · serviço fotográfico"}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `p_${f.key}`;
          const err = e?.[`params.${f.key}`];
          const props = { ...inputProps(id, e ? { [id]: err ?? "" } : undefined) };
          return (
            <Field key={`${docType}-${f.key}`} id={id} label={f.label} error={err}>
              {f.key === "retencaoIss" ? (
                <select {...props} defaultValue=""><option value="">Selecione</option>{Object.entries(RETENCAO_ISS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              ) : f.key === "infCpl" ? (
                <textarea {...props} rows={2} />
              ) : (
                <input {...props} />
              )}
            </Field>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {docType === "NFE" && (
          <Field id="ufDestino" label="UF de destino" error={e?.ufDestino} hint="Em branco = vale para todas as UFs.">
            <select {...inputProps("ufDestino", e)} defaultValue=""><option value="">Todas</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </Field>
        )}
        <Field id="validFrom" label="Início da vigência" error={e?.validFrom}><input type="date" {...inputProps("validFrom", e)} /></Field>
        <Field id="validTo" label="Fim da vigência (opcional)" error={e?.validTo}><input type="date" {...inputProps("validTo", e)} /></Field>
      </div>
      <Field id="justification" label="Justificativa e origem" error={e?.justification} hint="Ex.: parecer do contador, consulta à SEFAZ, legislação aplicada.">
        <textarea {...inputProps("justification", e)} rows={3} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}><Plus size={18} aria-hidden="true" /> Criar regra (aguarda aprovação)</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ApproveForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(approveRule, {});
  return (
    <form action={action} className="grid gap-1.5">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" name="confirm" required className="accent-[var(--accent)]" /> Revisei
      </label>
      <button type="submit" disabled={pending} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] font-semibold hover:bg-fg/5">Aprovar</button>
      <Feedback state={state} />
    </form>
  );
}

// React 19 limpa o formulário após uma action; aqui mantemos o que foi digitado para corrigir só o campo com erro.
function keep(action: (f: FormData) => void) {
  return (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const data = new FormData(ev.currentTarget);
    startTransition(() => action(data));
  };
}

export function NfeNumberingForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    (prev: FormState, f: FormData) => configureNfeNumbering(prev, Object.fromEntries(f)),
    {},
  );
  const e = state.errors;
  const p = (name: string) => ({ ...inputProps(`${name}-${id}`, e && { [`${name}-${id}`]: e[name] }), name, inputMode: "numeric" as const });
  return (
    <form action={action} className="mt-2 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <Field id={`nfeSeries-${id}`} label="Série da NF-e" error={e?.nfeSeries} hint="A mesma série usada hoje na empresa."><input {...p("nfeSeries")} /></Field>
      <Field id={`nfeNextNumber-${id}`} label="Próximo número da NF-e" error={e?.nfeNextNumber} hint="Último número emitido nesta série + 1."><input {...p("nfeNextNumber")} /></Field>
      <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
        <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-[var(--accent)]" />
        Conferi série e número com a última NF-e emitida. Depois de salvo, não é possível alterar por esta tela.
      </label>
      <div className="grid gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={`${btn} w-fit`}>Salvar numeração</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
