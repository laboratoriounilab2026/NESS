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

  it("saveOrder: rejeita ref inválida e não grava sem estabelecimento", async () => {
    const { saveOrder } = await import("./actions");
    const { db } = await import("@/lib/db");
    expect(await saveOrder(valid, "x")).toMatchObject({ ok: false });
    if ((await db.establishment.count()) === 0) {
      const ref = crypto.randomUUID();
      expect(await saveOrder(valid, ref)).toMatchObject({ ok: false, message: expect.stringMatching(/estabelecimento/i) });
      expect(await db.emissionOrder.count({ where: { ref } })).toBe(0);
    }
  });

  it("saveOrder: duas chamadas com a mesma ref geram um só pedido, notas PENDENTES", async () => {
    const { saveOrder } = await import("./actions");
    const { db } = await import("@/lib/db");
    const tag = `teste-save-${crypto.randomUUID()}`;
    const own = (await db.establishment.count()) === 0
      ? await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } })
      : null;
    if ((await db.establishment.count()) !== 1) return; // ambiente com vários estabelecimentos: cenário não se aplica
    const ref = crypto.randomUUID();
    try {
      const [a, b] = [await saveOrder(valid, ref), await saveOrder(valid, ref)];
      expect(a.ok && b.ok && a.id === b.id).toBe(true);
      const docs = await db.emissionDocument.findMany({ where: { order: { ref } } });
      expect(docs.map((d) => d.state)).toEqual(["PENDENTE", "PENDENTE"]);
      // Itens digitados são guardados (vão para as notas), não só os totais.
      const saved = await db.emissionOrder.findUniqueOrThrow({ where: { ref } });
      expect(saved).toMatchObject({ serviceDescription: valid.service.description, goodsDescription: valid.goods.description, goodsQuantity: 1, goodsUnitCents: 25000, goodsCents: 25000 });
    } finally {
      const o = await db.emissionOrder.findUnique({ where: { ref } });
      if (o) {
        await db.emissionDocument.deleteMany({ where: { orderId: o.id } });
        await db.emissionOrder.delete({ where: { id: o.id } });
        if (o.recipientId) await db.recipient.delete({ where: { id: o.recipientId } });
      }
      if (own) await db.establishment.delete({ where: { id: own.id } });
    }
  });
  it("saveOrder: mesmo CPF com e sem pontuação é um cliente só; nome novo atualiza o cadastro e é auditado", async () => {
    const { saveOrder } = await import("./actions");
    const { db } = await import("@/lib/db");
    const tag = `teste-cli-${crypto.randomUUID()}`;
    const own = (await db.establishment.count()) === 0
      ? await db.establishment.create({ data: { cnpj: tag, name: "Teste", uf: "SP", municipioIbge: "0000000", regime: "1" } })
      : null;
    if ((await db.establishment.count()) !== 1) return;
    // CPF aleatório com dígitos válidos (não pertence a ninguém conhecido; apagado ao final).
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const dv = (ds: number[]) => { const r = (ds.reduce((a, d, i) => a + d * (ds.length + 1 - i), 0) * 10) % 11; return r === 10 ? 0 : r; };
    const digits = [...base, dv(base)]; digits.push(dv(digits));
    const cpf = digits.join("");
    const pretty = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
    const refs = [crypto.randomUUID(), crypto.randomUUID()];
    try {
      expect(await saveOrder({ ...valid, customer: { document: pretty, name: "Nome Antigo", email: "" } }, refs[0])).toMatchObject({ ok: true });
      expect(await saveOrder({ ...valid, customer: { document: cpf, name: "Nome Novo", email: "" } }, refs[1])).toMatchObject({ ok: true });
      // Dois pedidos simultâneos do mesmo tomador também não duplicam o cadastro.
      refs.push(crypto.randomUUID(), crypto.randomUUID());
      const both = await Promise.all(refs.slice(2).map((r) => saveOrder({ ...valid, customer: { document: cpf, name: "Nome Novo", email: "" } }, r)));
      expect(both.every((x) => x.ok)).toBe(true);
      const customers = await db.customer.findMany({ where: { document: { in: [cpf, pretty] } } });
      expect(customers).toHaveLength(1);
      expect(customers[0]).toMatchObject({ document: cpf, name: "Nome Novo" });
      expect(await db.auditEvent.count({ where: { action: "cliente.atualizar", entityId: customers[0].id } })).toBe(1);
    } finally {
      const orders = await db.emissionOrder.findMany({ where: { ref: { in: refs } } });
      for (const o of orders) {
        await db.emissionDocument.deleteMany({ where: { orderId: o.id } });
        await db.emissionOrder.delete({ where: { id: o.id } });
        if (o.recipientId) await db.recipient.delete({ where: { id: o.recipientId } });
      }
      const c = await db.customer.findMany({ where: { document: { in: [cpf, pretty] } } });
      await db.auditEvent.deleteMany({ where: { entityId: { in: c.map((x) => x.id) } } });
      await db.customer.deleteMany({ where: { id: { in: c.map((x) => x.id) } } });
      if (own) await db.establishment.delete({ where: { id: own.id } });
    }
  });
  it("lookupCustomer: acha pelo documento com ou sem pontuação; documento inválido não consulta", async () => {
    const { lookupCustomer } = await import("./actions");
    const { db } = await import("@/lib/db");
    const c = await db.customer.create({ data: { document: "11222333000181", name: `teste-lookup-${crypto.randomUUID()}`, email: "a@b.test" } });
    try {
      expect(await lookupCustomer("11.222.333/0001-81")).toEqual({ name: c.name, email: "a@b.test" });
      expect(await lookupCustomer("11222333000180")).toBeNull(); // DV errado
      expect(await lookupCustomer(42)).toBeNull();
    } finally {
      await db.customer.delete({ where: { id: c.id } });
    }
  });
});
