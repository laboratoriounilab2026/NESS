import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("destino pós-login", () => {
  it("aceita caminho interno com query", () => {
    expect(safeNext("/pedidos/abc")).toBe("/pedidos/abc");
    expect(safeNext("/pedidos?situacao=aguardando")).toBe("/pedidos?situacao=aguardando");
  });

  it("recusa qualquer coisa que leve para fora ou volte ao login", () => {
    for (const bad of ["https://mal.example", "//mal.example", "/\\mal.example", "/x\\y", "javascript:alert(1)", "/ x", "", null, 42, "/login", "/login?next=/x"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
