import { afterAll, describe, expect, it } from "vitest";
import type { EmitterAdapter, QueryResult, SendResult } from "@/emitters/types";

// Emissor falso programável: só para teste, nunca ligado à interface.
function fake(sends: (SendResult | Error)[], queries: QueryResult[] = []) {
  const calls = { send: [] as string[], query: [] as string[] };
  const adapter: EmitterAdapter = {
    async send(req) {
      calls.send.push(req.idempotencyKey);
      await new Promise((r) => setTimeout(r, 20));
      const next = sends.shift() ?? { kind: "timeout" };
      if (next instanceof Error) throw next;
      return next;
    },
    async query(req) {
      calls.query.push(req.idempotencyKey);
      return queries.shift() ?? { kind: "unknown" };
    },
  };
  return { adapter, calls };
}
const ok = (n: string): SendResult => ({ kind: "authorized", accessKey: `chave-teste-${n}-${crypto.randomUUID()}`, protocol: `prot-${n}` });
const ctx = { actor: "teste-orquestrador", correlationId: "00000000-teste" };

describe.skipIf(!process.env.DATABASE_URL)("orquestrador (banco)", async () => {
  const { db } = await import("@/lib/db");
  const { discardOrder, emitDocument, emitOrder, markStaleSent, reconcileDocument } = await import("./emit");
  const tag = `teste-orq-${crypto.randomUUID()}`;
  const est = await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
  const customer = await db.customer.create({ data: { document: "00000000000", name: tag } });
  const rule = await db.fiscalRule.create({
    data: { establishmentId: est.id, docType: "NFE", purpose: "teste", version: 1, params: {}, validFrom: new Date(), justification: "teste", createdBy: "teste" },
  });

  async function newOrder(withRule = true) {
    const order = await db.emissionOrder.create({
      data: { ref: `${tag}-${crypto.randomUUID()}`, state: "EMITINDO", establishmentId: est.id, customerId: customer.id, serviceCents: 100, goodsCents: 50 },
    });
    for (const type of ["NFSE", "NFE"] as const) {
      await db.emissionDocument.create({ data: { orderId: order.id, type, fiscalRuleId: withRule ? rule.id : null } });
    }
    const docs = await db.emissionDocument.findMany({ where: { orderId: order.id } });
    return { order, nfse: docs.find((d) => d.type === "NFSE")!, nfe: docs.find((d) => d.type === "NFE")! };
  }
  const orderState = async (id: string) => (await db.emissionOrder.findUniqueOrThrow({ where: { id } })).state;

  afterAll(async () => {
    const orders = await db.emissionOrder.findMany({ where: { establishmentId: est.id }, select: { id: true } });
    const ids = orders.map((o) => o.id);
    await db.emissionAttempt.deleteMany({ where: { document: { orderId: { in: ids } } } });
    await db.emissionDocument.deleteMany({ where: { orderId: { in: ids } } });
    await db.emissionOrder.deleteMany({ where: { id: { in: ids } } });
    await db.fiscalRule.deleteMany({ where: { establishmentId: est.id } });
    await db.customer.delete({ where: { id: customer.id } });
    await db.establishment.delete({ where: { id: est.id } });
    await db.auditEvent.deleteMany({ where: { actor: ctx.actor } });
  });

  it("duas autorizadas → COMPLETO, chave guardada", async () => {
    const { order } = await newOrder();
    const nfse = fake([ok("s")]), nfe = fake([ok("e")]);
    const r = await emitOrder(order.id, { NFSE: nfse.adapter, NFE: nfe.adapter }, ctx);
    expect(r.order).toBe("COMPLETO");
    expect(nfse.calls.send).toEqual([`${order.id}:NFSE:1`]);
    const docs = await db.emissionDocument.findMany({ where: { orderId: order.id } });
    expect(docs.every((d) => d.state === "AUTORIZADO" && d.accessKey)).toBe(true);
  });

  it("NF-e rejeitada não desfaz a NFS-e → PARCIAL", async () => {
    const { order } = await newOrder();
    const r = await emitOrder(order.id, { NFSE: fake([ok("s")]).adapter, NFE: fake([{ kind: "rejected", code: "999", message: "teste" }]).adapter }, ctx);
    expect(r).toMatchObject({ order: "PARCIAL", docs: { NFSE: { state: "AUTORIZADO" }, NFE: { state: "REJEITADO" } } });
  });

  it("timeout → INCERTO; não reenvia; consulta 'não encontrado' libera nova tentativa com nova chave", async () => {
    const { order, nfe } = await newOrder();
    const f = fake([{ kind: "timeout" }, ok("e")], [{ kind: "not_found" }]);
    expect((await emitDocument(nfe.id, f.adapter, ctx)).state).toBe("INCERTO");
    expect((await emitDocument(nfe.id, f.adapter, ctx)).state).toBe("INCERTO"); // não reenviou
    expect(f.calls.send).toHaveLength(1);
    expect(await orderState(order.id)).toBe("EMITINDO");

    expect((await reconcileDocument(nfe.id, f.adapter, ctx)).state).toBe("PENDENTE");
    expect(f.calls.query).toEqual([`${order.id}:NFE:1`]);
    expect((await emitDocument(nfe.id, f.adapter, ctx)).state).toBe("AUTORIZADO");
    expect(f.calls.send).toEqual([`${order.id}:NFE:1`, `${order.id}:NFE:2`]);
  });

  it("timeout e a consulta mostra que foi autorizada: autoriza sem reenviar", async () => {
    const { nfe } = await newOrder();
    const f = fake([{ kind: "timeout" }], [{ kind: "unknown" }, { kind: "authorized", accessKey: `chave-teste-${crypto.randomUUID()}`, protocol: "p" }]);
    await emitDocument(nfe.id, f.adapter, ctx);
    expect((await reconcileDocument(nfe.id, f.adapter, ctx)).state).toBe("INCERTO"); // consulta falhou: segue incerto
    expect((await reconcileDocument(nfe.id, f.adapter, ctx)).state).toBe("AUTORIZADO");
    expect(f.calls.send).toHaveLength(1);
  });

  it("erro de rede no envio é tratado como incerto, não como rejeição", async () => {
    const { nfe } = await newOrder();
    expect((await emitDocument(nfe.id, fake([new Error("ECONNRESET")]).adapter, ctx)).state).toBe("INCERTO");
  });

  it("dois envios simultâneos da mesma nota: só um chega ao emissor", async () => {
    const { nfe } = await newOrder();
    const f = fake([ok("e"), ok("e2")]);
    const [a, b] = await Promise.all([emitDocument(nfe.id, f.adapter, ctx), emitDocument(nfe.id, f.adapter, ctx)]);
    expect(f.calls.send).toHaveLength(1);
    expect([a.state, b.state].sort()).toEqual(["AUTORIZADO", "ENVIADO"]);
  });

  // Simula processo que caiu durante o envio: nota presa em ENVIADO desde "dez minutos atrás".
  async function stuckSent(docId: string, withAttempt: boolean) {
    const old = new Date(Date.now() - 10 * 60_000);
    if (withAttempt) {
      const doc = await db.emissionDocument.findUniqueOrThrow({ where: { id: docId } });
      await db.emissionAttempt.create({ data: { documentId: docId, seq: 1, idempotencyKey: `${doc.orderId}:${doc.type}:1`, correlationId: "teste", startedAt: old } });
    }
    await db.$executeRaw`UPDATE "EmissionDocument" SET state = 'ENVIADO', "updatedAt" = ${old} WHERE id = ${docId}`;
  }

  it("envio interrompido (ENVIADO sem resposta): vira INCERTO e só sai por consulta, sem reenviar", async () => {
    const { order, nfe } = await newOrder();
    await stuckSent(nfe.id, true);
    expect(await markStaleSent(order.id, ctx, 60 * 60_000)).toBe(0); // ainda dentro do prazo
    expect(await markStaleSent(order.id, ctx)).toBe(1);
    const f = fake([], [{ kind: "authorized", accessKey: `chave-teste-${crypto.randomUUID()}`, protocol: "p" }]);
    expect((await reconcileDocument(nfe.id, f.adapter, ctx)).state).toBe("AUTORIZADO");
    expect(f.calls.query).toEqual([`${order.id}:NFE:1`]);
    expect(f.calls.send).toHaveLength(0);
  });

  it("caiu antes de registrar a tentativa: nada foi enviado, volta a PENDENTE", async () => {
    const { order, nfe } = await newOrder();
    await stuckSent(nfe.id, false);
    expect(await markStaleSent(order.id, ctx)).toBe(1);
    const f = fake([]);
    expect((await reconcileDocument(nfe.id, f.adapter, ctx)).state).toBe("PENDENTE");
    expect(f.calls.query).toHaveLength(0);
  });

  it("nota de pedido descartado nunca chega ao emissor, mesmo chamando o envio direto", async () => {
    const { order, nfe } = await newOrder();
    await db.emissionOrder.update({ where: { id: order.id }, data: { state: "PRONTO_REVISAO" } });
    expect(await discardOrder(order.id, ctx)).toEqual({ ok: true });
    const f = fake([ok("e")]);
    expect((await emitDocument(nfe.id, f.adapter, ctx)).detail).toMatch(/descartado/);
    expect(f.calls.send).toHaveLength(0);
  });

  it("resposta tardia não sobrescreve nota que já mudou de situação; fica auditada", async () => {
    const { nfe } = await newOrder();
    const late: EmitterAdapter = {
      async send() {
        // Enquanto esperava: recuperação + consulta "não encontrada" já devolveram a nota a PENDENTE.
        await db.$executeRaw`UPDATE "EmissionDocument" SET state = 'PENDENTE' WHERE id = ${nfe.id}`;
        return ok("tarde");
      },
      async query() {
        return { kind: "unknown" };
      },
    };
    const r = await emitDocument(nfe.id, late, ctx);
    expect(r.detail).toMatch(/depois de a nota mudar/);
    const d = await db.emissionDocument.findUniqueOrThrow({ where: { id: nfe.id } });
    expect(d).toMatchObject({ state: "PENDENTE", accessKey: null });
    expect(await db.auditEvent.count({ where: { action: "nota.resposta_tardia", entityId: nfe.id } })).toBe(1);
  });

  it("consulta não sobrescreve nota resolvida por outra consulta enquanto esperava", async () => {
    const { nfe } = await newOrder();
    await emitDocument(nfe.id, fake([{ kind: "timeout" }]).adapter, ctx);
    const key = `chave-teste-${crypto.randomUUID()}`;
    const racing: EmitterAdapter = {
      async send() {
        return { kind: "timeout" };
      },
      async query() {
        // Outra consulta resolveu primeiro como autorizada.
        await db.$executeRaw`UPDATE "EmissionDocument" SET state = 'AUTORIZADO', "accessKey" = ${key} WHERE id = ${nfe.id}`;
        return { kind: "not_found" };
      },
    };
    expect(await reconcileDocument(nfe.id, racing, ctx)).toMatchObject({ state: "AUTORIZADO" });
    expect(await db.emissionDocument.findUniqueOrThrow({ where: { id: nfe.id } })).toMatchObject({ state: "AUTORIZADO", accessKey: key });
  });

  it("nota sem regra fiscal não é enviada", async () => {
    const { nfe } = await newOrder(false);
    const f = fake([ok("e")]);
    expect((await emitDocument(nfe.id, f.adapter, ctx)).detail).toMatch(/sem regra/);
    expect(f.calls.send).toHaveLength(0);
  });
});
