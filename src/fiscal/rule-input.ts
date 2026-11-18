import { z } from "zod";
import { isValidCnpj, UFS } from "@/domain/order-input";

// Validação de FORMATO apenas. Nenhum valor fiscal tem padrão: tudo vem do responsável fiscal.
// ponytail: o conjunto de campos será conferido contra os layouts na fase dos emissores (NF-e 4.00 / DPS nacional).

const opt = (re: RegExp, msg: string) => z.string().trim().refine((s) => s === "" || re.test(s), msg);
const req = (re: RegExp, msg: string) => z.string().trim().regex(re, msg);
const text = (min: number, msg: string) => z.string().trim().min(min, msg).max(500);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

// CRT do layout da NF-e (fato do layout, não enquadramento).
export const REGIMES = {
  "1": "Simples Nacional",
  "2": "Simples Nacional — excesso de sublimite",
  "3": "Regime Normal",
  "4": "MEI",
} as const;

export const establishmentSchema = z.object({
  cnpj: z.string().refine(isValidCnpj, "CNPJ inválido"),
  name: text(2, "Informe a razão social"),
  uf: z.enum(UFS, "Selecione a UF"),
  municipioIbge: req(/^\d{7}$/, "Código IBGE do município tem 7 dígitos"),
  regime: z.enum(Object.keys(REGIMES) as [keyof typeof REGIMES], "Selecione o regime"),
});

// Numeração da NF-e (limites do layout 4.00). Sem padrão: a empresa pode continuar a sequência de outro emissor.
const intField = (msg: string, min: number, max: number, range: string) =>
  z.coerce.number<string>(msg).int("Use número inteiro").min(min, range).max(max, range);

// Limites de layout: NF-e série 0–999 e número até 999.999.999; DPS série 1–99999 (número limitado ao INTEGER do banco).
export const numberingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NFE"), series: intField("Informe a série", 0, 999, "Série de 0 a 999"), nextNumber: intField("Informe o número", 1, 999_999_999, "De 1 a 999.999.999") }),
  z.object({ kind: z.literal("NFSE"), series: intField("Informe a série", 1, 99_999, "Série de 1 a 99999"), nextNumber: intField("Informe o número", 1, 2_147_483_647, "De 1 a 2.147.483.647") }),
]);

export const NFE_FIELDS = [
  { key: "natOp", label: "Natureza da operação", schema: text(3, "Informe a natureza da operação") },
  { key: "cfop", label: "CFOP", schema: req(/^\d{4}$/, "CFOP tem 4 dígitos") },
  { key: "ncm", label: "NCM", schema: req(/^\d{8}$/, "NCM tem 8 dígitos") },
  { key: "origem", label: "Origem da mercadoria", schema: req(/^\d$/, "Origem é 1 dígito") },
  { key: "cstIcms", label: "CST ou CSOSN do ICMS", schema: req(/^\d{2,3}$/, "2 ou 3 dígitos") },
  { key: "cstPis", label: "CST do PIS", schema: req(/^\d{2}$/, "2 dígitos") },
  { key: "cstCofins", label: "CST da COFINS", schema: req(/^\d{2}$/, "2 dígitos") },
  { key: "infCpl", label: "Informações complementares (opcional)", schema: z.string().trim().max(2000) },
] as const;

export const NFSE_FIELDS = [
  { key: "cTribNac", label: "Código de tributação nacional", schema: req(/^\d{6}$/, "6 dígitos") },
  { key: "cTribMun", label: "Código de tributação municipal (opcional)", schema: opt(/^\d{3}$/, "3 dígitos") },
  { key: "aliquotaIss", label: "Alíquota do ISS em % (opcional)", schema: opt(/^\d{1,2}(,\d{1,2})?$/, "Ex.: 2,00") },
  { key: "retencaoIss", label: "Retenção do ISS", schema: z.enum(["1", "2", "3"], "Selecione") },
] as const;

export const RETENCAO_ISS = { "1": "Não retido", "2": "Retido pelo tomador", "3": "Retido pelo intermediário" } as const;

const paramsSchema = (fields: readonly { key: string; schema: z.ZodType }[]) =>
  z.object(Object.fromEntries(fields.map((f) => [f.key, f.schema])));

const common = {
  ufDestino: z.union([z.literal(""), z.enum(UFS)]),
  // Pedido ainda não informa município à resolução: regra com município nunca seria aplicada. Recusar, não ignorar.
  municipioIbge: z.literal("", "Regra por município ainda não é suportada (pendência fiscal: definir município da prestação ou da entrega)."),
  validFrom: date,
  validTo: z.union([z.literal(""), date]),
  justification: text(10, "Explique a origem da regra (mín. 10 caracteres), ex.: parecer do contador de 10/11/2026"),
};

export const ruleSchema = z
  .discriminatedUnion("docType", [
    z.object({ docType: z.literal("NFE"), purpose: z.literal("album"), params: paramsSchema(NFE_FIELDS), ...common }),
    z.object({ docType: z.literal("NFSE"), purpose: z.literal("servico-fotografico"), params: paramsSchema(NFSE_FIELDS), ...common }),
  ])
  .refine((r) => r.validTo === "" || r.validTo > r.validFrom, { path: ["validTo"], message: "Fim da vigência deve ser depois do início" });

export type RuleInput = z.output<typeof ruleSchema>;
