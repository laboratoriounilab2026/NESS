import { afterAll, describe, expect, it, vi } from "vitest";

// Cookie jar em memória no lugar do next/headers; redirect vira exceção inspecionável.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

describe.skipIf(!process.env.DATABASE_URL)("login (banco)", async () => {
  const { db } = await import("@/lib/db");
  const { hashPassword } = await import("@/auth/password");
  const email = `teste-${crypto.randomUUID()}@exemplo.invalid`;
  const pw = "senha-de-teste-longa";
  await db.user.create({ data: { email, name: "Operador Teste", role: "OPERADOR", passwordHash: await hashPassword(pw) } });
  const form = (p: string) => {
    const f = new FormData();
    f.set("email", email);
    f.set("password", p);
    return f;
  };

  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
  });

  it("senha errada: erro genérico, sem cookie", async () => {
    const { login } = await import("./actions");
    expect(await login({}, form("errada-errada-errada"))).toEqual({ error: "E-mail ou senha incorretos." });
    expect(jar.size).toBe(0);
  });

  it("senha certa: cria sessão (só hash no banco) e redireciona", async () => {
    const { login } = await import("./actions");
    await expect(login({}, form(pw))).rejects.toThrow("REDIRECT:/");
    const token = jar.get("ness_session")!;
    expect(token).toBeTruthy();
    expect(await db.session.count({ where: { tokenHash: token } })).toBe(0);

    const { currentUser, requireUser } = await import("@/auth/session");
    expect(await currentUser()).toMatchObject({ name: "Operador Teste", role: "OPERADOR" });
    await expect(requireUser("FISCAL", "ADMIN")).rejects.toThrow("Sem permissão");
  });

  it("sair apaga sessão e cookie", async () => {
    const { logout } = await import("./actions");
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(jar.size).toBe(0);
    const { currentUser } = await import("@/auth/session");
    expect(await currentUser()).toBeNull();
  });

  it("bloqueia após 5 falhas, mesmo com a senha certa", async () => {
    const { login } = await import("./actions");
    for (let i = 0; i < 4; i++) await login({}, form("errada-errada-errada")); // 1 falha já veio do primeiro teste
    expect(await login({}, form(pw))).toEqual({ error: "Muitas tentativas. Aguarde 15 minutos e tente de novo." });
  });
});
