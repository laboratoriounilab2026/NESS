import { describe, expect, it } from "vitest";
import { buildAccessKey, isValidAccessKey, randomCode, type AccessKeyParts } from "./access-key";

// Valores esperados calculados por implementação independente (Python) do módulo 11.
const base: AccessKeyParts = {
  uf: "SP", issuedAt: new Date("2026-11-15T12:00:00Z"), cnpj: "11.222.333/0001-81",
  model: "55", series: 1, number: 123, emissionType: 1, randomCode: "12345678",
};

describe("chave de acesso NF-e", () => {
  it("monta 44 posições com DV correto", () => {
    expect(buildAccessKey(base)).toBe("35261111222333000181550010000001231123456787");
  });

  it("aceita CNPJ alfanumérico", () => {
    expect(buildAccessKey({ ...base, cnpj: "12.ABC.345/01DE-35" })).toBe("35261112ABC34501DE35550010000001231123456788");
  });

  it("AAMM usa o fuso de Brasília (virada do mês em UTC ainda é mês anterior)", () => {
    expect(buildAccessKey({ ...base, issuedAt: new Date("2026-12-01T02:00:00Z") }).slice(2, 6)).toBe("2611");
  });

  it("valida e detecta dígito alterado", () => {
    const k = buildAccessKey(base);
    expect(isValidAccessKey(k)).toBe(true);
    expect(isValidAccessKey(k.slice(0, 43) + ((Number(k[43]) + 1) % 10))).toBe(false);
    expect(isValidAccessKey(k.slice(0, 40))).toBe(false);
  });

  it("recusa campos fora do layout", () => {
    expect(() => buildAccessKey({ ...base, number: 0 })).toThrow();
    expect(() => buildAccessKey({ ...base, series: 1000 })).toThrow();
    expect(() => buildAccessKey({ ...base, randomCode: "123" })).toThrow();
    expect(() => buildAccessKey({ ...base, number: 12345678, randomCode: "12345678" })).toThrow(/cNF/);
  });

  it("cNF aleatório tem 8 dígitos e nunca repete o número da nota", () => {
    for (let i = 0; i < 200; i++) {
      const c = randomCode(123);
      expect(c).toMatch(/^\d{8}$/);
      expect(c).not.toBe("00000123");
    }
  });
});
