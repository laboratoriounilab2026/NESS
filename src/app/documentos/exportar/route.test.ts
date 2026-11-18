import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/session", () => ({ requireUser: async () => ({ id: "teste-exportar", name: "Teste", role: "OPERADOR" }) }));

describe.skipIf(!process.env.DATABASE_URL)("exportação CSV (banco)", async () => {
  const { db } = await import("@/lib/db");
  const { GET } = await import("./route");
  const tag = `teste-exp-${crypto.randomUUID()}`;
  const est = await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } });
  const customer = await db.customer.create({ data: { document: "00000000000", name: "=SOMA(1;2)" } });
  const order = await db.emissionOrder.create({
    data: { ref: tag, state: "COMPLETO", establishmentId: est.id, customerId: customer.id, serviceCents: 10050, goodsCents: 2000 },
  });
  // Autorizada às 01:30 UTC de 01/12 = 22:30 de 30/11 em Brasília: pertence a novembro.
  const doc = await db.emissionDocument.create({
    data: { orderId: order.id, type: "NFSE", state: "AUTORIZADO", accessKey: `chave-${tag}`, protocol: "p1" },
  });
  await db.emissionAttempt.create({
    data: { documentId: doc.id, seq: 1, idempotencyKey: `${tag}:1`, correlationId: "c", resultState: "AUTORIZADO", finishedAt: new Date("2026-12-01T01:30:00Z") },
  });
  const get = async (mes: string) => GET(new Request(`http://x/documentos/exportar?mes=${mes}`));

  afterAll(async () => {
    await db.emissionAttempt.deleteMany({ where: { documentId: doc.id } });
    await db.emissionDocument.delete({ where: { id: doc.id } });
    await db.emissionOrder.delete({ where: { id: order.id } });
    await db.customer.delete({ where: { id: customer.id } });
    await db.establishment.delete({ where: { id: est.id } });
    await db.auditEvent.deleteMany({ where: { actor: "teste-exportar" } });
  });

  it("nota autorizada às 22:30 de 30/11 (Brasília) entra em novembro, não em dezembro", async () => {
    const nov = await (await get("2026-11")).text();
    expect(nov).toContain(`chave-${tag}`);
    expect(nov).toContain("100,50"); // valor do serviço (NFS-e)
    expect(await (await get("2026-12")).text()).not.toContain(`chave-${tag}`);
  });

  it("nome com fórmula sai como texto; arquivo com BOM; exportação auditada", async () => {
    const res = await get("2026-11");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM (text() o removeria ao decodificar)
    const body = new TextDecoder().decode(bytes);
    expect(body).toContain(`"'=SOMA(1;2)"`);
    expect(res.headers.get("content-disposition")).toContain("notas-autorizadas-2026-11.csv");
    expect(await db.auditEvent.count({ where: { actor: "teste-exportar", action: "documentos.exportar" } })).toBeGreaterThan(0);
  });

  it("mês inválido é recusado", async () => {
    expect((await get("2026-13")).status).toBe(400);
    expect((await get("x")).status).toBe(400);
  });
});
