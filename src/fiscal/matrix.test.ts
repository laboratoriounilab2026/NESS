import { describe, expect, it } from "vitest";
import { resolveRule, type FiscalRuleRecord, type RuleContext } from "./matrix";

const d = (s: string) => new Date(s);
const base: FiscalRuleRecord = {
  id: "geral", establishmentId: "e1", docType: "NFE", purpose: "album", ufDestino: null, municipioIbge: null,
  version: 1, validFrom: d("2026-01-01"), validTo: null, approvedAt: d("2026-01-01"),
};
const ctx: RuleContext = { establishmentId: "e1", docType: "NFE", purpose: "album", ufDestino: "SP", at: d("2026-06-01") };

describe("matriz fiscal", () => {
  it("sem regra → bloqueia com explicação", () => {
    const r = resolveRule([], ctx);
    expect(r.status).toBe("blocked");
  });
  it("regra não aprovada não habilita", () => {
    expect(resolveRule([{ ...base, approvedAt: null }], ctx).status).toBe("blocked");
  });
  it("fora da vigência não habilita", () => {
    expect(resolveRule([{ ...base, validTo: d("2026-05-01") }], ctx).status).toBe("blocked");
    expect(resolveRule([{ ...base, validFrom: d("2026-07-01") }], ctx).status).toBe("blocked");
  });
  it("regra de outra UF não vale", () => {
    expect(resolveRule([{ ...base, ufDestino: "PR" }], ctx).status).toBe("blocked");
  });
  it("mais específica vence; depois maior versão", () => {
    const r = resolveRule([base, { ...base, id: "sp", ufDestino: "SP" }, { ...base, id: "geral2", version: 2 }], ctx);
    expect(r).toEqual({ status: "ok", ruleId: "sp", version: 1 });
    expect(resolveRule([base, { ...base, id: "geral2", version: 2 }], ctx)).toMatchObject({ ruleId: "geral2" });
  });
  it("conflito empatado bloqueia", () => {
    expect(resolveRule([base, { ...base, id: "outra" }], ctx).status).toBe("blocked");
  });
});
