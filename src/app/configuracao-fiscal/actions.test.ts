import { afterAll, describe, expect, it, vi } from "vitest";
import { NFE_TEST_PARAMS, NFSE_TEST_PARAMS } from "@/test/fiscal-params";

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
const params = NFE_TEST_PARAMS;
const rule = { docType: "NFE", purpose: "album", ufDestino: "SP", municipioIbge: "", validFrom: "2020-01-01", validTo: "", justification: "Teste automatizado de fluxo", params };
const order = {
  customer: { document: "529.982.247-25", name: "Cliente Teste", email: "" },
  recipient: { same: false, name: "Dest", document: "", cep: "01001-000", street: "Rua", number: "1", district: "Centro", city: "São Paulo", uf: "SP" },
  service: { description: "Ensaio", value: "100", date: "2026-11-10", uf: "SP", city: "São Paulo" },
  goods: { description: "Álbum", quantity: "1", unitValue: "50", payment: "17" },
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
    r = await checkOrder({ ...order, recipient: { ...order.recipient, uf: "PR", city: "Curitiba" } });
    expect(r.ok && r.nfe.status).toBe("blocked");
  });

  it("numeração da NF-e: só ADMIN, exige confirmação, valida limites e grava uma única vez", async () => {
    const a = await import("./actions");
    const e = await db.establishment.create({ data: { cnpj: `teste-num-${crypto.randomUUID()}`, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
    try {
      const ok = { id: e.id, kind: "NFE", series: "1", nextNumber: "120", confirm: "on" };
      role = "FISCAL";
      await expect(a.configureNumbering({}, ok)).rejects.toThrow("Sem permissão");
      role = "ADMIN";
      expect(await a.configureNumbering({}, { ...ok, confirm: undefined })).toMatchObject({ errors: { _: expect.any(String) } });
      expect(await a.configureNumbering({}, { ...ok, series: "1000" })).toMatchObject({ errors: { series: expect.any(String) } });
      expect(await a.configureNumbering({}, { ...ok, nextNumber: "0" })).toMatchObject({ errors: { nextNumber: expect.any(String) } });
      expect(await a.configureNumbering({}, ok)).toEqual({ ok: "Numeração da NF-e configurada." });
      // DPS é independente e tem limites próprios (série 1–99999).
      expect(await a.configureNumbering({}, { ...ok, kind: "NFSE", series: "0" })).toMatchObject({ errors: { series: expect.any(String) } });
      expect(await a.configureNumbering({}, { ...ok, kind: "NFSE", series: "50000" })).toMatchObject({ errors: { series: expect.stringMatching(/49999/) } }); // faixa do Emissor Móvel
      expect(await a.configureNumbering({}, { ...ok, kind: "NFSE", series: "12345", nextNumber: "7" })).toEqual({ ok: "Numeração da DPS (NFS-e) configurada." });
      expect(await a.configureNumbering({}, { ...ok, nextNumber: "5" })).toMatchObject({ errors: { _: expect.any(String) } }); // não muda depois
      expect(await db.establishment.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ nfeSeries: 1, nfeNextNumber: 120, dpsSeries: 12345, dpsNextNumber: 7 });
    } finally {
      await db.establishment.delete({ where: { id: e.id } });
    }
  });
  it("aprovar regra libera os pedidos bloqueados que passam a ter as duas regras", async () => {
    const a = await import("./actions");
    const tag = `teste-lib-${crypto.randomUUID()}`;
    const e = await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
    const customer = await db.customer.create({ data: { document: "00000000000", name: tag } });
    const recipient = await db.recipient.create({ data: { name: tag, cep: "01001000", street: "R", number: "1", district: "C", city: "São Paulo", uf: "SP" } });
    const base = { establishmentId: e.id, version: 1, validFrom: new Date(Date.now() - 60_000), justification: "teste", createdBy: "teste" };
    const nfse = await db.fiscalRule.create({ data: { ...base, params: NFSE_TEST_PARAMS, docType: "NFSE", purpose: "servico-fotografico", approvedBy: "teste", approvedAt: new Date() } });
    const nfe = await db.fiscalRule.create({ data: { ...base, params: NFE_TEST_PARAMS, docType: "NFE", purpose: "album" } }); // aguardando aprovação
    const order = await db.emissionOrder.create({
      data: {
        ref: tag, state: "BLOQUEADO", establishmentId: e.id, customerId: customer.id, recipientId: recipient.id, serviceCents: 1, goodsCents: 1,
        documents: { create: [{ type: "NFSE", fiscalRuleId: nfse.id }, { type: "NFE" }] },
      },
    });
    try {
      role = "FISCAL";
      const f = new FormData();
      f.set("id", nfe.id);
      f.set("confirm", "on");
      expect(await a.approveRule({}, f)).toMatchObject({ ok: expect.stringMatching(/1 pedido bloqueado ficou pronto/) });
      expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: order.id } })).state).toBe("PRONTO_REVISAO");
    } finally {
      await db.emissionDocument.deleteMany({ where: { orderId: order.id } });
      await db.emissionOrder.delete({ where: { id: order.id } });
      await db.recipient.delete({ where: { id: recipient.id } });
      await db.customer.delete({ where: { id: customer.id } });
      await db.fiscalRule.deleteMany({ where: { establishmentId: e.id } });
      await db.establishment.delete({ where: { id: e.id } });
    }
  });

  it("dados da empresa: só ADMIN, validados e auditados", async () => {
    const a = await import("./actions");
    const e = await db.establishment.create({ data: { cnpj: `teste-dados-${crypto.randomUUID()}`, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
    try {
      const data = { id: e.id, street: "Rua A", number: "10", district: "Centro", cep: "01001-000", city: "São Paulo", stateRegistration: "ISENTO", municipalRegistration: "123" };
      role = "FISCAL";
      await expect(a.updateEstablishmentData({}, data)).rejects.toThrow("Sem permissão");
      role = "ADMIN";
      expect(await a.updateEstablishmentData({}, { ...data, cep: "1" })).toMatchObject({ errors: { cep: expect.any(String) } });
      expect(await a.updateEstablishmentData({}, data)).toEqual({ ok: "Dados da empresa salvos." });
      expect(await db.establishment.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ cep: "01001000", stateRegistration: "ISENTO", municipalRegistration: "123" });
      expect(await db.auditEvent.count({ where: { action: "estabelecimento.dados", entityId: e.id } })).toBe(1);
    } finally {
      await db.auditEvent.deleteMany({ where: { entityId: e.id } });
      await db.establishment.delete({ where: { id: e.id } });
    }
  });
});
