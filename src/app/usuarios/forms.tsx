"use client";

import { startTransition, useActionState } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { createUserAction, deleteUserAction, resetPasswordAction, setActiveAction, type FormState } from "./actions";

const inputCls = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-err";
const btn = "inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg disabled:opacity-60";
const btnGhost = "inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-60";

function Feedback({ state }: { state: FormState }) {
  if (state.ok) return <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok"><CircleCheck size={16} aria-hidden="true" />{state.ok}</p>;
  const msg = state.errors?._ ?? state.errors?.password ?? (state.errors ? "Corrija os campos destacados." : null);
  return msg ? <p role="alert" className="text-sm font-semibold text-err">{msg}</p> : null;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="text-[13px] font-semibold text-err">{error}</p>}
    </div>
  );
}

const submit = (action: (f: FormData) => void) => (ev: React.FormEvent<HTMLFormElement>) => {
  ev.preventDefault();
  const data = new FormData(ev.currentTarget);
  startTransition(() => action(data));
};

export function CreateUserForm() {
  const [state, action, pending] = useActionState((p: FormState, f: FormData) => createUserAction(p, Object.fromEntries(f)), {});
  const e = state.errors;
  const props = (id: string) => ({ id, name: id, className: inputCls, "aria-invalid": e?.[id] ? true : undefined, "aria-describedby": e?.[id] ? `${id}-err` : undefined });
  return (
    <form onSubmit={submit(action)} className="mt-3 grid gap-4 sm:grid-cols-2">
      <Field id="name" label="Nome" error={e?.name}><input {...props("name")} autoComplete="off" /></Field>
      <Field id="email" label="E-mail" error={e?.email}><input {...props("email")} type="email" autoComplete="off" /></Field>
      <Field id="role" label="Papel" error={e?.role}>
        <select {...props("role")} defaultValue="">
          <option value="">Selecione</option>
          <option value="OPERADOR">Operador: cria e emite pedidos</option>
          <option value="FISCAL">Fiscal: cria e aprova regras fiscais</option>
          <option value="ADMIN">Administrador: empresa, contas e tudo acima</option>
        </select>
      </Field>
      <Field id="password" label="Senha inicial (mín. 12)" error={e?.password}><input {...props("password")} type="password" autoComplete="new-password" /></Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={btn}><Plus size={18} aria-hidden="true" /> Criar conta</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function UserRowActions({ id, active, self }: { id: string; active: boolean; self: boolean }) {
  const [pwState, pwAction, pwPending] = useActionState((p: FormState, f: FormData) => resetPasswordAction(p, Object.fromEntries(f)), {});
  const [actState, toggle, actPending] = useActionState(() => setActiveAction(id, !active), {});
  const [delState, remove, delPending] = useActionState(() => deleteUserAction(id), {});
  return (
    <div className="grid gap-2">
      <form onSubmit={submit(pwAction)} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor={`pw-${id}`}>Nova senha</label>
        <input id={`pw-${id}`} name="password" type="password" autoComplete="new-password" placeholder="Nova senha" className={`${inputCls} max-w-48 py-2 text-sm`} />
        <button type="submit" disabled={pwPending} className={btnGhost}>Trocar senha</button>
        {!self && (
          <button type="button" disabled={actPending} className={btnGhost}
            onClick={() => (active ? confirm("Bloquear o acesso desta conta?") : true) && startTransition(toggle)}>
            {active ? "Desativar" : "Reativar"}
          </button>
        )}
        {!self && (
          <button type="button" disabled={delPending} className={`${btnGhost} text-err`}
            onClick={() => confirm("Excluir esta conta de vez? Não dá para desfazer.") && startTransition(remove)}>
            Excluir
          </button>
        )}
      </form>
      <Feedback state={delState.ok || delState.errors ? delState : pwState.ok || pwState.errors ? pwState : actState} />
    </div>
  );
}
