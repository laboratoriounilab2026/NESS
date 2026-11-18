import { describe, expect, it } from "vitest";
import { establishmentDataSchema, establishmentSchema, ruleSchema } from "./rule-input";

// Valores abaixo são só de formato para teste — não são orientação fiscal.
const nfe = {
  docType: "NFE", purpose: "album", ufDestino: "", municipioIbge: "", validFrom: "2026-01-01", validTo: "",
  justification: "Teste de formato apenas",
  params: { natOp: "abc", cfop: "1234", ncm: "12345678", origem: "0", cstIcms: "123", cstPis: "01", cstCofins: "01", infCpl: "" },
};

describe("regra fiscal", () => {
  it("aceita formato válido", () => expect(ruleSchema.safeParse(nfe).success).toBe(true));
  it("recusa CFOP fora do formato", () => {
    expect(ruleSchema.safeParse({ ...nfe, params: { ...nfe.params, cfop: "12" } }).success).toBe(false);
  });
  it("recusa vigência invertida", () => {
    expect(ruleSchema.safeParse({ ...nfe, validTo: "2025-12-31" }).success).toBe(false);
  });
  it("finalidade precisa casar com o tipo de nota", () => {
    expect(ruleSchema.safeParse({ ...nfe, purpose: "servico-fotografico" }).success).toBe(false);
  });
  it("recusa regra por município (seria ignorada na resolução)", () => {
    expect(ruleSchema.safeParse({ ...nfe, municipioIbge: "1234567" }).success).toBe(false);
  });
  it("exige justificativa", () => {
    expect(ruleSchema.safeParse({ ...nfe, justification: "" }).success).toBe(false);
  });
});

describe("estabelecimento", () => {
  it("valida CNPJ e IBGE", () => {
    const ok = { cnpj: "11.222.333/0001-81", name: "Empresa", uf: "SP", municipioIbge: "1234567", regime: "1" };
    expect(establishmentSchema.safeParse(ok).success).toBe(true);
    expect(establishmentSchema.safeParse({ ...ok, cnpj: "11.222.333/0001-80" }).success).toBe(false);
    expect(establishmentSchema.safeParse({ ...ok, municipioIbge: "123" }).success).toBe(false);
  });
});

describe("dados cadastrais da empresa", () => {
  const ok = { street: "Rua A", number: "10", district: "Centro", cep: "01001-000", city: "São Paulo", stateRegistration: "110.042.490.114", municipalRegistration: "" };
  it("normaliza CEP e IE; aceita ISENTO em qualquer caixa", () => {
    expect(establishmentDataSchema.parse(ok)).toMatchObject({ cep: "01001000", stateRegistration: "110042490114" });
    expect(establishmentDataSchema.parse({ ...ok, stateRegistration: "isento" }).stateRegistration).toBe("ISENTO");
  });
  it("recusa IE com letras e CEP incompleto", () => {
    expect(establishmentDataSchema.safeParse({ ...ok, stateRegistration: "12AB" }).success).toBe(false);
    expect(establishmentDataSchema.safeParse({ ...ok, cep: "0100" }).success).toBe(false);
  });
});
