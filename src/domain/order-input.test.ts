import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, isValidCnpj, isValidCpf, orderSchema, parseBRL } from "./order-input";

describe("documentos", () => {
  it("CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
  it("CNPJ numérico e alfanumérico", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-36")).toBe(false);
  });
});

describe("dinheiro", () => {
  it("converte formato brasileiro em centavos", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 80")).toBe(8000);
    expect(parseBRL("0,1")).toBe(10);
    expect(parseBRL("12,345")).toBeNaN();
    expect(parseBRL("abc")).toBeNaN();
  });
});

describe("pedido", () => {
  it("rascunho vazio é inválido; pedido completo é válido", () => {
    expect(orderSchema.safeParse(EMPTY_DRAFT).success).toBe(false);
    const ok = orderSchema.parse({
      customer: { document: "529.982.247-25", name: "Cliente Teste", email: "" },
      recipient: { same: false, name: "Destinatário", document: "", cep: "01001-000", street: "Rua A", number: "1", district: "Centro", city: "São Paulo", uf: "SP" },
      service: { description: "Ensaio", value: "1.000,00", date: "2026-11-10", uf: "SP", city: "São Paulo" },
      goods: { description: "Álbum 30x30", quantity: "2", unitValue: "250", payment: "17" },
    });
    expect(ok.service.value).toBe(100000);
    expect(ok.goods.quantity).toBe(2);
  });

  it("destinatário 'mesma pessoa' sempre usa o tomador atual (ignora nome/documento antigos)", () => {
    const o = orderSchema.parse({
      customer: { document: "529.982.247-25", name: "Nome Corrigido", email: "" },
      recipient: { same: true, name: "Nome Antigo", document: "", cep: "01001-000", street: "Rua A", number: "1", district: "Centro", city: "São Paulo", uf: "SP" },
      service: { description: "Ensaio", value: "100", date: "2026-11-10", uf: "SP", city: "São Paulo" },
      goods: { description: "Álbum", quantity: "1", unitValue: "50", payment: "17" },
    });
    expect(o.recipient).toMatchObject({ name: "Nome Corrigido", document: "52998224725" });
  });
});
