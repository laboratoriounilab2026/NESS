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
  const { emitOrderAction, recheckRulesAction, retryRejectedAction, updateRecipientAction } = await import("./actions");
  const tag = `teste-acao-${crypto.randomUUID()}`;
  const est = await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
  const customer = await db.customer.create({ data: { document: "00000000000", name: tag } });
  const recipient = await db.recipient.create({ data: { name: tag, cep: "01001000", street: "Rua", number: "1", district: "Centro", city: "São Paulo", uf: "SP" } });
  // Regras de teste nas finalidades que o sistema procura; parâmetros vazios (nenhum valor fiscal inventado).
  const approve = (docType: "NFSE" | "NFE", purpose: string, version = 1) =>
    db.fiscalRule.create({
      data: {
        establishmentId: est.id, docType, purpose, version, params: {}, validFrom: new Date(Date.now() - 60_000),
        justification: "teste", createdBy: "teste", approvedBy: "teste", approvedAt: new Date(),
      },
    });
  const rule = await approve("NFSE", "servico-fotografico");
  const nfeRule = await approve("NFE", "album");

  async function newOrder(state: "PRONTO_REVISAO" | "BLOQUEADO" = "PRONTO_REVISAO") {
    return db.emissionOrder.create({
      data: {
        ref: `${tag}-${crypto.randomUUID()}`, state, establishmentId: est.id, customerId: customer.id, recipientId: recipient.id, serviceCents: 100, goodsCents: 50,
        documents: { create: [{ type: "NFSE", fiscalRuleId: rule.id }, { type: "NFE", fiscalRuleId: state === "BLOQUEADO" ? null : nfeRule.id }] },
      },
    });
  }
  const attempts = (orderId: string) => db.emissionAttempt.count({ where: { document: { orderId } } });

  beforeEach(async () => {
    registry.adapter = null;
    await db.fiscalRule.update({ where: { id: nfeRule.id }, data: { validTo: null } });
  });

  afterAll(async () => {
    const orders = await db.emissionOrder.findMany({ where: { establishmentId: est.id }, select: { id: true, recipientId: true } });
    const ids = orders.map((o) => o.id);
    const extraRecipients = orders.flatMap((o) => (o.recipientId && o.recipientId !== recipient.id ? [o.recipientId] : []));
    await db.emissionAttempt.deleteMany({ where: { document: { orderId: { in: ids } } } });
    await db.emissionDocument.deleteMany({ where: { orderId: { in: ids } } });
    await db.emissionOrder.deleteMany({ where: { id: { in: ids } } });
    await db.fiscalRule.deleteMany({ where: { establishmentId: est.id } });
    await db.customer.delete({ where: { id: customer.id } });
    await db.recipient.deleteMany({ where: { id: { in: [recipient.id, ...extraRecipients] } } });
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
    await db.fiscalRule.update({ where: { id: nfeRule.id }, data: { validTo: new Date(Date.now() - 1000) } }); // sem regra NF-e vigente
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

  it("regra venceu depois do cadastro: emissão bloqueada, pedido volta a BLOQUEADO, nada enviado", async () => {
    const o = await newOrder();
    await db.fiscalRule.update({ where: { id: nfeRule.id }, data: { validTo: new Date(Date.now() - 1000) } });
    registry.adapter = authorized;
    expect(await emitOrderAction(o.id, true)).toMatchObject({ ok: false, message: expect.stringMatching(/regra fiscal/) });
    expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("BLOQUEADO");
    expect(await attempts(o.id)).toBe(0);
  });

  it("NF-e rejeitada: liberar nova tentativa usa nova chave e conclui o pedido", async () => {
    const o = await newOrder();
    registry.adapter = {
      ...authorized,
      send: async (req) => (req.docType === "NFE" ? { kind: "rejected", code: "999", message: "teste" } : authorized.send(req)),
    };
    await emitOrderAction(o.id, true);
    expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("PARCIAL");

    expect(await retryRejectedAction(o.id, false)).toMatchObject({ ok: false });
    expect(await retryRejectedAction(o.id, true)).toMatchObject({ ok: true });
    expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("EMITINDO");

    registry.adapter = authorized;
    expect(await emitOrderAction(o.id, true)).toMatchObject({ ok: true, docs: { NFE: { state: "AUTORIZADO" } } });
    expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("COMPLETO");
    const keys = (await db.emissionAttempt.findMany({ where: { document: { orderId: o.id, type: "NFE" } }, orderBy: { seq: "asc" } })).map((a) => a.idempotencyKey);
    expect(keys).toEqual([`${o.id}:NFE:1`, `${o.id}:NFE:2`]);
    expect(await retryRejectedAction(o.id, true)).toMatchObject({ ok: false }); // nada mais a liberar
  });

  it("corrigir destinatário: valida no servidor, cria registro novo e trava após envio da NF-e", async () => {
    const o = await newOrder();
    const addr = { name: "Fulano", document: "", cep: "01001000", street: "Rua B", number: "2", district: "Centro", city: "Campinas", uf: "SP" };
    expect(await updateRecipientAction(o.id, { ...addr, cep: "123" })).toMatchObject({ ok: false, errors: { cep: expect.any(String) } });

    expect(await updateRecipientAction(o.id, addr)).toMatchObject({ ok: true });
    const after = await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id }, include: { recipient: true } });
    expect(after.recipientId).not.toBe(recipient.id); // original preservado
    expect(after.recipient?.city).toBe("Campinas");
    expect(after.state).toBe("PRONTO_REVISAO");

    registry.adapter = authorized;
    await emitOrderAction(o.id, true);
    expect(await updateRecipientAction(o.id, addr)).toMatchObject({ ok: false, message: expect.stringMatching(/já foi enviada/) });
  });

  it("regra aprovada depois do bloqueio: verificar de novo libera o pedido", async () => {
    const o = await newOrder("BLOQUEADO");
    await db.fiscalRule.update({ where: { id: nfeRule.id }, data: { validTo: new Date(Date.now() - 1000) } });
    expect(await recheckRulesAction(o.id)).toMatchObject({ ok: false, message: expect.stringMatching(/NF-e/) });
    await approve("NFE", "album", 2); // nova versão aprovada e vigente
    expect(await recheckRulesAction(o.id)).toMatchObject({ ok: true });
    expect((await db.emissionOrder.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("PRONTO_REVISAO");
    expect(await db.emissionDocument.count({ where: { orderId: o.id, fiscalRuleId: null } })).toBe(0);
  });
});
