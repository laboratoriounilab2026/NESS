import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function Login() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <section className="reveal grid w-full max-w-sm gap-5 rounded-tile border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2.5 font-display text-xl font-bold tracking-[0.06em]">
          <Logo size={30} /> NESS
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Entrar</h1>
          <p className="text-sm text-muted">Acesso restrito à equipe. Contas são criadas pelo administrador.</p>
        </div>
        <LoginForm />
      </section>
    </div>
  );
}
