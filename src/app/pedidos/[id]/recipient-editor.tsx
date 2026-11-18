"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MapPin } from "lucide-react";
import { UFS } from "@/domain/order-input";
import { updateRecipientAction, type RecipientEdit } from "./actions";

const inputCls = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-err";

const FIELDS: [keyof RecipientEdit, string][] = [
  ["name", "Nome de quem recebe"],
  ["document", "CPF ou CNPJ (opcional)"],
  ["cep", "CEP"],
  ["street", "Rua"],
  ["number", "Número"],
  ["district", "Bairro"],
  ["city", "Cidade"],
];

/** Correção do destinatário enquanto a NF-e não foi enviada ou foi rejeitada (servidor revalida tudo). */
export function RecipientEditor({ orderId, initial }: { orderId: string; initial: RecipientEdit }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (form: FormData) =>
    startTransition(async () => {
      const raw = Object.fromEntries(FIELDS.map(([k]) => [k, String(form.get(k) ?? "")]).concat([["uf", String(form.get("uf") ?? "")]]));
      const r = await updateRecipientAction(orderId, raw);
      setErrors(r.errors ?? {});
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });

  const err = (k: string) => errors[k] && <p id={`rcp-${k}-err`} className="text-[13px] font-semibold text-err">{errors[k]}</p>;
  const aria = (k: string) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `rcp-${k}-err` } : {});

  return (
    <details className="rounded-tile border border-line bg-surface p-5 sm:p-6">
      <summary className="inline-flex cursor-pointer items-center gap-2 font-semibold">
        <MapPin size={16} aria-hidden="true" /> Corrigir destinatário da NF-e
      </summary>
      <form action={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, label]) => (
          <div key={k} className="grid gap-1.5">
            <label htmlFor={`rcp-${k}`} className="text-sm font-semibold">{label}</label>
            <input id={`rcp-${k}`} name={k} defaultValue={initial[k]} className={inputCls} {...aria(k)} />
            {err(k)}
          </div>
        ))}
        <div className="grid gap-1.5">
          <label htmlFor="rcp-uf" className="text-sm font-semibold">UF</label>
          <select id="rcp-uf" name="uf" defaultValue={initial.uf} className={inputCls} {...aria("uf")}>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
          {err("uf")}
        </div>
        <p className="text-sm text-muted sm:col-span-2">Mudar a UF pode mudar a regra fiscal da NF-e; o pedido é verificado de novo ao salvar.</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-fg/5 disabled:opacity-60"
        >
          {pending && <LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          Salvar destinatário
        </button>
        <p role="status" className={`text-sm sm:col-span-2 ${message && !message.ok ? "text-err" : "text-muted"}`}>{message?.text}</p>
      </form>
    </details>
  );
}
