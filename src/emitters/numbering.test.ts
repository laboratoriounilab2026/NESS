import { afterAll, describe, expect, it } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("numeração NF-e e DPS (banco)", async () => {
  const { db } = await import("@/lib/db");
  const { reserveNumber: reserveNfeNumber } = await import("./numbering");
  const tag = `teste-num-${crypto.randomUUID()}`;
  // Série/número só de teste; na aplicação vêm do administrador.
  const est = await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1", nfeSeries: 7, nfeNextNumber: 500, dpsSeries: 3, dpsNextNumber: 90 } });
  const bare = await db.establishment.create({ data: { cnpj: `${tag}-sem`, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
  const customer = await db.customer.create({ data: { document: "00000000000", name: tag } });

  const order = (establishmentId: string) =>
    db.emissionOrder.create({
      data: { ref: `${tag}-${crypto.randomUUID()}`, establishmentId, customerId: customer.id, serviceCents: 1, goodsCents: 1, documents: { create: [{ type: "NFSE" }, { type: "NFE" }] } },
      include: { documents: { orderBy: { type: "asc" } } },
    });
  const nfe = async (establishmentId = est.id) => (await order(establishmentId)).documents[1];

  afterAll(async () => {
    const where = { establishmentId: { in: [est.id, bare.id] } };
    await db.nfeNumber.deleteMany({ where });
    await db.dpsNumber.deleteMany({ where });
    const ids = (await db.emissionOrder.findMany({ where, select: { id: true } })).map((o) => o.id);
    await db.emissionDocument.deleteMany({ where: { orderId: { in: ids } } });
    await db.emissionOrder.deleteMany({ where: { id: { in: ids } } });
    await db.customer.delete({ where: { id: customer.id } });
    await db.establishment.deleteMany({ where: { id: { in: [est.id, bare.id] } } });
  });

  it("reserva em sequência e repete o mesmo número para a mesma nota", async () => {
    const a = await nfe();
    const b = await nfe();
    expect(await reserveNfeNumber(a.id)).toEqual({ ok: true, series: 7, number: 500 });
    expect(await reserveNfeNumber(a.id)).toEqual({ ok: true, series: 7, number: 500 }); // nova tentativa
    expect(await reserveNfeNumber(b.id)).toEqual({ ok: true, series: 7, number: 501 });
  });

  it("chamadas simultâneas na mesma nota não consomem dois números", async () => {
    const c = await nfe();
    const [x, y] = await Promise.all([reserveNfeNumber(c.id), reserveNfeNumber(c.id)]);
    expect(x).toEqual(y);
    expect((await db.establishment.findUniqueOrThrow({ where: { id: est.id } })).nfeNextNumber).toBe(503);
  });

  it("sem série configurada, bloqueia", async () => {
    expect(await reserveNfeNumber((await nfe(bare.id)).id)).toMatchObject({ ok: false, reason: expect.stringMatching(/NF-e não configurados/) });
    expect(await reserveNfeNumber((await order(bare.id)).documents[0].id)).toMatchObject({ ok: false, reason: expect.stringMatching(/DPS/) });
  });

  it("NFS-e usa a sequência da DPS, independente da NF-e", async () => {
    const o = await order(est.id);
    expect(await reserveNfeNumber(o.documents[0].id)).toEqual({ ok: true, series: 3, number: 90 });
    expect(await reserveNfeNumber(o.documents[0].id)).toEqual({ ok: true, series: 3, number: 90 });
    expect((await db.establishment.findUniqueOrThrow({ where: { id: est.id } })).dpsNextNumber).toBe(91);
  });
});
