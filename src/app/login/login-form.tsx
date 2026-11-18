"use client";

import { useActionState, useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { login, type LoginState } from "./actions";

const inputCls = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  // Lido no navegador para a página de login continuar estática; o servidor valida o destino (safeNext).
  const [next, setNext] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- query string só existe no navegador
  useEffect(() => setNext(new URLSearchParams(location.search).get("next") ?? ""), []);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={inputCls} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </div>
      {state.error && <p role="alert" className="text-sm font-semibold text-err">{state.error}</p>}
      <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg disabled:opacity-60">
        <LogIn size={18} aria-hidden="true" /> {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
