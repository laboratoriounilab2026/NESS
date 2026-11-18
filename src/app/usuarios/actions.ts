"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/audit/audit";
import { hashPassword, MIN_PASSWORD } from "@/auth/password";
import { requireUser } from "@/auth/session";
import { issuesByPath } from "@/domain/order-input";
import { db } from "@/lib/db";

export type FormState = { ok?: string; errors?: Record<string, string> };

const password = z.string().min(MIN_PASSWORD, `Mínimo de ${MIN_PASSWORD} caracteres`).max(200);
const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  name: z.string().trim().min(2, "Informe o nome").max(120),
  role: z.enum(["OPERADOR", "FISCAL", "ADMIN"], { message: "Escolha o papel" }),
  password,
});

const log = (actor: string, action: string, entityId: string, result: string, data?: Record<string, string>) =>
  audit({ actor, action, entity: "User", entityId, result, correlationId: crypto.randomUUID(), data });

export async function createUserAction(_prev: FormState, raw: unknown): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { errors: issuesByPath(parsed.error) };
  const { password: pw, ...d } = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email } })) return { errors: { email: "Já existe conta com esse e-mail" } };
  const u = await db.user.create({ data: { ...d, passwordHash: await hashPassword(pw) } });
  await log(admin.id, "conta.criar", u.id, "sucesso", { papel: d.role });
  revalidatePath("/usuarios");
  return { ok: "Conta criada. Passe a senha à pessoa por um canal seguro." };
}

/** Troca a senha e encerra as sessões da conta (inclusive a sua, se for você: entre de novo). */
export async function resetPasswordAction(_prev: FormState, raw: unknown): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  const r = raw as Record<string, unknown>;
  const id = String(r?.id ?? "");
  const parsed = password.safeParse(r?.password);
  if (!parsed.success) return { errors: { password: parsed.error.issues[0].message } };
  const hash = await hashPassword(parsed.data);
  const count = await db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({ where: { id }, data: { passwordHash: hash } });
    await tx.session.deleteMany({ where: { userId: id } });
    return count;
  });
  await log(admin.id, "conta.senha", id, count === 1 ? "sucesso" : "ignorado");
  if (count !== 1) return { errors: { _: "Conta não encontrada." } };
  revalidatePath("/usuarios");
  return { ok: "Senha trocada; sessões abertas encerradas." };
}

export async function setActiveAction(id: string, active: boolean): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  if (id === admin.id) return { errors: { _: "Você não pode desativar a própria conta." } };
  const count = await db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({ where: { id }, data: { active } });
    if (!active) await tx.session.deleteMany({ where: { userId: id } });
    return count;
  });
  await log(admin.id, active ? "conta.ativar" : "conta.desativar", id, count === 1 ? "sucesso" : "ignorado");
  revalidatePath("/usuarios");
  return count === 1 ? { ok: active ? "Acesso reativado." : "Acesso bloqueado." } : { errors: { _: "Conta não encontrada." } };
}

/** Exclui a conta (irreversível; sessões caem junto). A auditoria guarda o id, não o nome. */
export async function deleteUserAction(id: string): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  if (id === admin.id) return { errors: { _: "Você não pode excluir a própria conta." } };
  const { count } = await db.user.deleteMany({ where: { id } });
  await log(admin.id, "conta.excluir", id, count === 1 ? "sucesso" : "ignorado");
  revalidatePath("/usuarios");
  return count === 1 ? { ok: "Conta excluída." } : { errors: { _: "Conta não encontrada." } };
}
