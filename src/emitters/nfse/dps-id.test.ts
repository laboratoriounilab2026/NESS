import { describe, expect, it } from "vitest";
import { buildDpsId } from "./dps-id";

// Documentos de exemplo (dígitos válidos, não reais) e município fictício.
describe("identificador da DPS", () => {
  it("CNPJ: 45 posições, tipo 2", () => {
    const id = buildDpsId({ municipioIbge: "1234567", document: "11.222.333/0001-81", series: 1, number: 42 });
    expect(id).toBe("DPS1234567211222333000181" + "00001" + "000000000000042");
    expect(id).toHaveLength(45);
  });

  it("CPF: completado com zeros, tipo 1", () => {
    expect(buildDpsId({ municipioIbge: "1234567", document: "529.982.247-25", series: 900, number: 1 }).slice(10, 25)).toBe("100052998224725");
  });

  it("aceita CNPJ alfanumérico", () => {
    expect(buildDpsId({ municipioIbge: "1234567", document: "12.ABC.345/01DE-35", series: 1, number: 1 }).slice(10, 25)).toBe("212ABC34501DE35");
  });

  it("recusa campos fora do layout", () => {
    const ok = { municipioIbge: "1234567", document: "11222333000181", series: 1, number: 1 };
    expect(() => buildDpsId({ ...ok, municipioIbge: "123" })).toThrow();
    expect(() => buildDpsId({ ...ok, document: "123" })).toThrow();
    expect(() => buildDpsId({ ...ok, series: 0 })).toThrow();
    expect(() => buildDpsId({ ...ok, number: 0 })).toThrow();
    expect(() => buildDpsId({ ...ok, number: 1e15 })).toThrow();
  });
});
