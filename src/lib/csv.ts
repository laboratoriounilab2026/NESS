// CSV para Excel em português: separador ";", BOM UTF-8 e proteção contra injeção de fórmula.

/** Célula segura: texto que começa com = + - @ (ou tab/CR) vira texto literal com apóstrofo, e aspas são escapadas. */
export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
