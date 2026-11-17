import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "ness_session";
const TTL_MS = 12 * 60 * 60 * 1000; // 12h: um turno de trabalho

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.session.create({ data: { tokenHash: sha(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!s || s.expiresAt <= new Date() || !s.user.active) return null;
  return { id: s.user.id, name: s.user.name, role: s.user.role };
}

export class ForbiddenError extends Error {
  constructor() {
    super("Sem permissão para esta ação");
  }
}

/** Validação de verdade (o proxy só faz checagem otimista do cookie). Sem papéis = qualquer usuário logado. */
export async function requireUser(...roles: Role[]) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export { sha as hashIdentifier };
