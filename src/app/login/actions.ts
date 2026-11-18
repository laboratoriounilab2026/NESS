"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/audit/audit";
import { verifyPassword } from "@/auth/password";
import { safeNext } from "@/auth/next-path";
import { createSession, destroySession, hashIdentifier } from "@/auth/session";
import { db } from "@/lib/db";

export type LoginState = { error?: string };

const schema = z.object({ email: z.string().trim().max(200).regex(/^[^\s@]+@[^\s@]+$/).transform((s) => s.toLowerCase()), password: z.string().min(1).max(200) });
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
// Hash fixo para gastar o mesmo tempo quando o e-mail não existe (não revela quais e-mails têm conta).
const DUMMY = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Informe e-mail e senha." };
  const { email, password } = parsed.data;
  const who = hashIdentifier(email); // auditoria sem o e-mail em claro
  const correlationId = crypto.randomUUID();

  // ponytail: limite por e-mail via auditoria; limite por IP entra com o proxy de produção.
  const fails = await db.auditEvent.count({
    where: { action: "auth.login", entityId: who, result: "falha", at: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  if (fails >= MAX_FAILS) return { error: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };

  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok || !user.active) {
    await audit({ actor: "anonimo", action: "auth.login", entity: "User", entityId: who, result: "falha", correlationId });
    return { error: "E-mail ou senha incorretos." };
  }

  await createSession(user.id);
  await audit({ actor: user.id, action: "auth.login", entity: "User", entityId: who, result: "sucesso", correlationId });
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
