// Identificador da DPS (NFS-e padrão nacional), 45 posições:
// "DPS" + cMun(7) + tpInsc(1: 1=CPF, 2=CNPJ) + inscrição(14, CPF com zeros à esquerda) + série(5) + nDPS(15).
// Composição conferida no Anexo VI v1.04.01 (NT 009), campo infDPS/id. O anexo fala em "42 posições numéricas";
// CNPJ alfanumérico aceito aqui pelo formato novo da RFB — conferir quando o leiaute atualizar.

export type DpsIdParts = {
  municipioIbge: string; // município emissor, 7 dígitos
  document: string; // CPF ou CNPJ (CNPJ pode ser alfanumérico) do prestador
  series: number; // 1–99999
  number: number; // 1–999999999999999
};

export function buildDpsId(p: DpsIdParts): string {
  if (!/^\d{7}$/.test(p.municipioIbge)) throw new Error("Município IBGE deve ter 7 dígitos");
  const doc = p.document.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const kind = /^\d{11}$/.test(doc) ? "1" : /^[0-9A-Z]{12}\d{2}$/.test(doc) ? "2" : null;
  if (!kind) throw new Error("Inscrição deve ser CPF (11) ou CNPJ (14)");
  if (!Number.isInteger(p.series) || p.series < 1 || p.series > 99_999) throw new Error("Série fora de 1–99999");
  if (!Number.isSafeInteger(p.number) || p.number < 1 || p.number > 999_999_999_999_999) throw new Error("Número fora de 1–999999999999999");
  return `DPS${p.municipioIbge}${kind}${doc.padStart(14, "0")}${String(p.series).padStart(5, "0")}${String(p.number).padStart(15, "0")}`;
}
