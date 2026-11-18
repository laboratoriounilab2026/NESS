import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmitterAdapter } from "@/emitters/types";

vi.mock("@/auth/session", () => ({ requireUser: async () => ({ id: "teste-emitir-acao", name: "Teste", role: "OPERADOR" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Emissor falso só aqui, via mock do registro: na aplicação o registro não tem adaptador.
const registry = vi.hoisted(() => ({ adapter: null as EmitterAdapter | null }));
vi.mock("@/emitters/registry", () => ({ getAdapter: () => registry.adapter }));

const authorized: EmitterAdapter = {
  send: async () => ({ kind: "authorized", accessKey: `chave-teste-${crypto.randomUUID()}`, protocol: "p" }),
  query: async () => ({ kind: "unknown" }),
};

describe.skipIf(!process.env.DATABASE_URL)("emitOrderAction (banco)", async () => {
  const { db } = await import("@/lib/db");
  const { emitOrderAction } = await import("./actions");
  const tag = `teste-acao-${crypto.randomUUID()}`;
  const est = await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
  const customer = await db.customer.create({ data: { document: "00000000000", name: tag } });
  const rule = await db.fiscalRule.create({
    data: { establishmentId: est.id, docType: "NFE", purpose: "teste", version: 1, params: {}, validFrom: new Date(), justification: "teste", createdBy: "teste" },
  });

  async function newOrder(state: "PRONTO_REVISAO" | "BLOQUEADO" = "PRONTO_REVISAO") {
    return db.emissionOrder.create({
      data: {
        ref: `${tag}-${crypto.randomUUID()}`, state, establishmentId: est.id, customerId: customer.id, serviceCents: 100, goodsCents: 50,
        documents: { create: [{ type: "NFSE", fiscalRuleId: rule.id }, { type: "NFE", fiscalRuleId: rule.id }] },
      },
    });
  }
  const attempts = (orderId: string) => db.emissionAttempt.count({ where: { document: { orderId } } });

  beforeEach(() => {
    registry.adapter = null;
  });

  afterAll(async () => {
    const ids = (await db.emissionOrder.findMany({ where: { establishmentId: est.id }, select: { id: true } })).map((o) => o.id);
    await db.emissionAttempt.deleteMany({ where: { document: { orderId: { in: ids } } } });
    await db.emissionDocument.deleteMany({ where: { orderId: { in: ids } } });
    await db.emissionOrder.deleteMany({ where: { id: { in: ids } } });
    await db.fiscalRule.deleteMany({ where: { establishmentId: est.id } });
    await db.customer.delete({ where: { id: customer.id } });
    await db.establishment.delete({ where: { id: est.id } });
    await db.auditEvent.deleteMany({ where: { actor: "teste-emitir-acao" } });
  });

  it("sem confirmação explícita não envia", async () => {
    const o = await newOrder();
    registry.adapter = authorized;
    expect(await emitOrderAction(o.id, false)).toMatchObject({ ok: false });
    expect(await attempts(o.id)).toBe(0);
  });

  it("sem emissor real configurado: nada é enviado, pedido não muda e a tentativa é auditada", async () => {
    const o = await newOrder();
    const r = await emitOrderAction(o.id, true);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/não configurada/) });
    expect(await attempts(o.id)).toBe(0);
    expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("PRONTO_REVISAO");
    const ev = await db.auditEvent.findFirstOrThrow({ where: { actor: "teste-emitir-acao", entityId: o.id } });
    expect(ev.result).toBe("bloqueado");
  });

  it("pedido bloqueado por regra fiscal é recusado mesmo com emissor", async () => {
    const o = await newOrder("BLOQUEADO");
    registry.adapter = authorized;
    expect(await emitOrderAction(o.id, true)).toMatchObject({ ok: false, message: expect.stringMatching(/regra fiscal/) });
    expect(await attempts(o.id)).toBe(0);
  });

  it("com emissor: envia as duas notas e o pedido fica COMPLETO; repetir não reenvia", async () => {
    const o = await newOrder();
    registry.adapter = authorized;
    expect(await emitOrderAction(o.id, true)).toMatchObject({ ok: true, docs: { NFSE: { state: "AUTORIZADO" }, NFE: { state: "AUTORIZADO" } } });
    expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("COMPLETO");
    expect(await emitOrderAction(o.id, true)).toMatchObject({ ok: false });
    expect(await attempts(o.id)).toBe(2);
  });
});
