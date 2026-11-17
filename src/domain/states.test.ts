import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, deriveOrderState, idempotencyKey } from "./states";

describe("transições de documento", () => {
  it("timeout vira INCERTO e não volta para ENVIADO sem reconciliar", () => {
    expect(canTransition("ENVIADO", "INCERTO")).toBe(true);
    expect(canTransition("INCERTO", "ENVIADO")).toBe(false);
  });
  it("estados finais não mudam", () => {
    expect(canTransition("CANCELADO", "AUTORIZADO")).toBe(false);
    expect(canTransition("DENEGADO", "PENDENTE")).toBe(false);
  });
  it("não autoriza sem envio", () => {
    expect(() => assertTransition("PENDENTE", "AUTORIZADO")).toThrow();
  });
});

describe("estado do pedido", () => {
  it("completo só com as duas autorizadas", () => {
    expect(deriveOrderState(["AUTORIZADO", "AUTORIZADO"])).toBe("COMPLETO");
  });
  it("sucesso parcial é representado", () => {
    expect(deriveOrderState(["AUTORIZADO", "REJEITADO"])).toBe("PARCIAL");
  });
  it("incerto mantém emitindo, não completo", () => {
    expect(deriveOrderState(["AUTORIZADO", "INCERTO"])).toBe("EMITINDO");
  });
  it("nenhuma autorizada é falha", () => {
    expect(deriveOrderState(["REJEITADO", "DENEGADO"])).toBe("FALHA");
  });
});

describe("idempotência", () => {
  it("chave estável e tentativa válida", () => {
    expect(idempotencyKey("o1", "NFE", 1)).toBe("o1:NFE:1");
    expect(() => idempotencyKey("o1", "NFE", 0)).toThrow();
  });
});
