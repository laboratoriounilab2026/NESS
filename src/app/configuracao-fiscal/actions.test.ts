import { afterAll, describe, expect, it, vi } from "vitest";

// Papel trocável por teste; o mock reproduz a checagem de papel do requireUser real.
let role: "ADMIN" | "FISCAL" | "OPERADOR" = "ADMIN";
vi.mock("@/auth/session", () => ({
  requireUser: async (...roles: string[]) => {
    if (roles.length && !roles.includes(role)) throw new Error("Sem permissão para esta ação");
    return { id: `teste-${role}`, name: "Teste", role };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Valores só de FORMATO, fictícios, apagados ao final — não são orientação fiscal.
const params = { natOp: "teste", cfop: "1234", ncm: "12345678", origem: "0", cstIcms: "123", cstPis: "01", cstCofins: "01", infCpl: "" };
const rule = { docType: "NFE", purpose: "album", ufDestino: "SP", municipioIbge: "", validFrom: "2020-01-01", validTo: "", justification: "Teste automatizado de fluxo", params };
const order = {
  customer: { document: "529.982.247-25", name: "Cliente Teste", email: "" },
  recipient: { same: false, name: "Dest", document: "", cep: "01001-000", street: "Rua", number: "1", district: "Centro", city: "Cidade", uf: "SP" },
  service: { description: "Ensaio", value: "100" },
  goods: { description: "Álbum", quantity: "1", unitValue: "50" },
};

describe.skipIf(!process.env.DATABASE_URL)("configuração fiscal (banco)", async () => {
  const { db } = await import("@/lib/db");
  const pre = await db.establishment.count();
  const cnpj = "11222333000181";

  afterAll(async () => {
    const e = await db.establishment.findUnique({ where: { cnpj } });
    if (e && pre === 0) {
      await db.fiscalRule.deleteMany({ where: { establishmentId: e.id } });
      await db.establishment.delete({ where: { id: e.id } });
    }
  });

  it("empresa → regra → aprovação → pedido liberado só na NF-e aprovada", async (ctx) => {
    if (pre > 0) ctx.skip(); // não mexe num banco que já tem empresa real
    const a = await import("./actions");
    const { checkOrder } = await import("@/app/pedidos/novo/actions");

    role = "FISCAL";
    await expect(a.createEstablishment({}, { cnpj, name: "Empresa Teste", uf: "SP", municipioIbge: "1234567", regime: "1" })).rejects.toThrow("Sem permissão");
    role = "ADMIN";
    expect(await a.createEstablishment({}, { cnpj, name: "Empresa Teste", uf: "SP", municipioIbge: "1234567", regime: "1" })).toMatchObject({ ok: expect.any(String) });
    const est = await db.establishment.findUniqueOrThrow({ where: { cnpj } });
    expect(est.environment).toBe("HOMOLOGACAO");

    await expect(a.createRule({}, rule)).rejects.toThrow("Sem permissão"); // admin não cria regra
    role = "FISCAL";
    expect(await a.createRule({}, { ...rule, params: { ...params, cfop: "12" } })).toMatchObject({ errors: { "params.cfop": expect.any(String) } });
    expect(await a.createRule({}, rule)).toMatchObject({ ok: expect.stringContaining("v1") });
    expect(await a.createRule({}, rule)).toMatchObject({ ok: expect.stringContaining("v2") });

    // Antes da aprovação: bloqueado.
    let r = await checkOrder(order);
    expect(r.ok && r.nfe.status).toBe("blocked");

    const v2 = await db.fiscalRule.findFirstOrThrow({ where: { establishmentId: est.id, version: 2 } });
    const f = new FormData();
    f.set("id", v2.id);
    expect(await a.approveRule({}, f)).toMatchObject({ errors: { _: expect.any(String) } }); // sem confirmar
    f.set("confirm", "on");
    role = "ADMIN";
    await expect(a.approveRule({}, f)).rejects.toThrow("Sem permissão");
    role = "FISCAL";
    expect(await a.approveRule({}, f)).toEqual({ ok: "Regra aprovada." });
    expect(await a.approveRule({}, f)).toMatchObject({ errors: { _: expect.any(String) } }); // não aprova duas vezes

    r = await checkOrder(order);
    expect(r).toMatchObject({ ok: true, nfe: { status: "ok", version: 2 }, nfse: { status: "blocked" } });
    // Outra UF continua bloqueada: a regra é só para SP.
    r = await checkOrder({ ...order, recipient: { ...order.recipient, uf: "PR" } });
    expect(r.ok && r.nfe.status).toBe("blocked");
  });
});
