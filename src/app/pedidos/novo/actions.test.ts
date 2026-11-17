import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/session", () => ({ requireUser: async () => ({ id: "usuario-teste", name: "Teste", role: "OPERADOR" }) }));

// Integração com o Postgres local (npx prisma dev). Pulado no CI sem DATABASE_URL.
describe.skipIf(!process.env.DATABASE_URL)("checkOrder (banco)", () => {
  const valid = {
    customer: { document: "529.982.247-25", name: "Cliente Teste", email: "" },
    recipient: { same: false, name: "Destinatário", document: "", cep: "01001-000", street: "Rua A", number: "1", district: "Centro", city: "São Paulo", uf: "SP" },
    service: { description: "Ensaio", value: "1.000,00" },
    goods: { description: "Álbum 30x30", quantity: "1", unitValue: "250" },
  };

  it("rejeita entrada inválida no servidor mesmo que o cliente aceite", async () => {
    const { checkOrder } = await import("./actions");
    const r = await checkOrder({ ...valid, customer: { ...valid.customer, document: "123" } });
    expect(r).toMatchObject({ ok: false, errors: { "customer.document": expect.any(String) } });
  });

  it("bloqueia as duas notas sem estabelecimento/regra e audita sem dados pessoais", async () => {
    const { checkOrder } = await import("./actions");
    const { db } = await import("@/lib/db");
    const mine = { actor: "usuario-teste" };
    const before = await db.auditEvent.count({ where: mine });
    const r = await checkOrder(valid);
    expect(r.ok && r.nfse.status).toBe("blocked");
    expect(r.ok && r.nfe.status).toBe("blocked");
    const last = await db.auditEvent.findFirstOrThrow({ where: mine, orderBy: { at: "desc" } });
    expect(await db.auditEvent.count({ where: mine })).toBe(before + 1);
    expect(last.result).toBe("bloqueado");
    expect(JSON.stringify(last)).not.toContain("52998224725");
  });
});
