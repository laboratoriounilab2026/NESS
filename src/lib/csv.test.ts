import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("CSV", () => {
  it("neutraliza fórmulas (injeção ao abrir no Excel)", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+55 11")).toBe("'+55 11");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@soma")).toBe("'@soma");
  });

  it("escapa separador, aspas e quebra de linha", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell("linha\nnova")).toBe('"linha\nnova"');
    expect(csvCell(null)).toBe("");
  });

  it("arquivo com BOM, ';' e CRLF", () => {
    expect(toCsv(["a", "b"], [["1", 2]])).toBe("﻿a;b\r\n1;2\r\n");
  });
});
