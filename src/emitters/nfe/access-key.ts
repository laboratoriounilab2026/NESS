import { UFS } from "@/domain/order-input";

// Chave de acesso da NF-e (layout 4.00): 44 posições, montada pelo emitente.
// cUF(2) AAMM(4) CNPJ(14) mod(2) série(3) nNF(9) tpEmis(1) cNF(8) cDV(1).
// CNPJ pode ser alfanumérico (IN RFB 2.229/2024); no DV cada caractere vale código ASCII − 48, como no CNPJ.

/** Código IBGE da UF (tabela do IBGE usada no campo cUF). */
export const UF_IBGE: Record<(typeof UFS)[number], string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

export type AccessKeyParts = {
  uf: (typeof UFS)[number];
  issuedAt: Date; // AAMM no fuso de Brasília
  cnpj: string;
  model: "55" | "65";
  series: number; // 0–999
  number: number; // 1–999999999
  emissionType: number; // tpEmis, 1–9
  randomCode: string; // cNF, 8 dígitos
};

/** Dígito verificador módulo 11, pesos 2..9 da direita para a esquerda; resto 0 ou 1 → 0. */
export function mod11(base: string): number {
  let sum = 0;
  for (let i = base.length - 1, w = 2; i >= 0; i--, w = w === 9 ? 2 : w + 1) sum += (base.charCodeAt(i) - 48) * w;
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

const pad = (n: number, len: number) => String(n).padStart(len, "0");

function yymm(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "2-digit", month: "2-digit" }).formatToParts(d);
  return parts.find((p) => p.type === "year")!.value + parts.find((p) => p.type === "month")!.value;
}

export function buildAccessKey(p: AccessKeyParts): string {
  const cnpj = p.cnpj.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) throw new Error("CNPJ deve ter 14 posições");
  if (!Number.isInteger(p.series) || p.series < 0 || p.series > 999) throw new Error("Série fora de 0–999");
  if (!Number.isInteger(p.number) || p.number < 1 || p.number > 999_999_999) throw new Error("Número fora de 1–999999999");
  if (!Number.isInteger(p.emissionType) || p.emissionType < 1 || p.emissionType > 9) throw new Error("tpEmis fora de 1–9");
  if (!/^\d{8}$/.test(p.randomCode)) throw new Error("cNF deve ter 8 dígitos");
  // cNF não pode repetir o número da nota (regra do layout).
  if (p.randomCode === pad(p.number, 8).slice(-8)) throw new Error("cNF não pode ser igual ao número da nota");

  const base = UF_IBGE[p.uf] + yymm(p.issuedAt) + cnpj + p.model + pad(p.series, 3) + pad(p.number, 9) + p.emissionType + p.randomCode;
  return base + mod11(base);
}

export function isValidAccessKey(key: string): boolean {
  return /^\d{6}[0-9A-Z]{12}\d{26}$/.test(key) && mod11(key.slice(0, 43)) === Number(key[43]);
}

/** cNF aleatório de 8 dígitos, diferente do número da nota. */
export function randomCode(number: number): string {
  for (;;) {
    const c = pad(crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000, 8);
    if (c !== pad(number, 8).slice(-8)) return c;
  }
}
