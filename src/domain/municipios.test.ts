import { describe, expect, it } from "vitest";
import { findMunicipio, municipiosOf } from "./municipios";
import { orderSchema } from "./order-input";

describe("municípios IBGE", () => {
  it("acha pelo nome sem diferenciar acento, caixa e pontuação; devolve nome oficial e código", () => {
    expect(findMunicipio("SP", "sao paulo")).toEqual({ code: "3550308", name: "São Paulo" });
    expect(findMunicipio("PA", "Santa Izabel do Para")?.code).toMatch(/^15\d{5}$/);
    expect(findMunicipio("RJ", "São Paulo")).toBeNull(); // existe, mas em outra UF
    expect(findMunicipio("SP", "Cidade Inventada")).toBeNull();
  });

  it("lista por UF, ordenada", () => {
    expect(municipiosOf("DF")).toEqual(["Brasília"]);
    expect(municipiosOf("SP")).toHaveLength(645);
  });

  it("pedido grava cidade oficial e código IBGE; cidade fora da UF é recusada", () => {
    const base = {
      customer: { document: "529.982.247-25", name: "Cliente", email: "" },
      recipient: { same: false, name: "Dest", document: "", cep: "01001-000", street: "Rua", number: "1", district: "Centro", city: "SAO PAULO", uf: "SP" as const },
      service: { description: "Ensaio", value: "100", date: "2026-11-10", uf: "SP", city: "São Paulo" },
      goods: { description: "Álbum", quantity: "1", unitValue: "50", payment: "17" },
    };
    expect(orderSchema.parse(base).recipient).toMatchObject({ city: "São Paulo", cityIbge: "3550308" });
    const bad = orderSchema.safeParse({ ...base, recipient: { ...base.recipient, uf: "RJ" } });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]).toMatchObject({ path: ["recipient", "city"] });
  });
});
