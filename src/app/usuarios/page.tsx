import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/auth/session";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { CreateUserForm, UserRowActions } from "./forms";

export const metadata: Metadata = { title: "Usuários" };

const card = "rounded-tile border border-line bg-surface p-5 sm:p-6";
const ROLE = { ADMIN: "Administrador", FISCAL: "Fiscal", OPERADOR: "Operador" } as const;

export default function Usuarios() {
  return (
    <div className="grid gap-3.5">
      <header className="reveal">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Usuários</h1>
        <p className="text-muted">Crie as contas da equipe, troque senhas e bloqueie acessos. Toda ação fica na auditoria.</p>
      </header>
      <Suspense fallback={<div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Carregando" />}>
        <Users />
      </Suspense>
    </div>
  );
}

async function Users() {
  const me = await requireUser("ADMIN");
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, active: true } });
  return (
    <>
      <section className={card}>
        <h2 className="font-display text-lg font-bold">Nova conta</h2>
        <CreateUserForm />
      </section>
      <section className={`${card} grid gap-4`}>
        <h2 className="font-display text-lg font-bold">Contas ({users.length})</h2>
        <ul className="grid gap-4">
          {users.map((u) => (
            <li key={u.id} className="grid gap-3 border-t border-line pt-4 first:border-0 first:pt-0 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-semibold">{u.name}{u.id === me.id && <span className="text-muted"> (você)</span>}</p>
                <p className="text-sm text-muted">{u.email} · {ROLE[u.role]}</p>
                <div className="mt-1"><StatusBadge status={u.active ? "ok" : "block"} label={u.active ? "Ativa" : "Desativada"} /></div>
              </div>
              <UserRowActions id={u.id} active={u.active} self={u.id === me.id} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
