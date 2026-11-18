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

// Dados cadastrais da empresa para as notas. Só formato: IE varia por UF, então aceita dígitos ou "ISENTO".
export const establishmentDataSchema = z.object({
  street: text(2, "Informe o logradouro"),
  number: z.string().trim().min(1, "Informe o número").max(60),
  district: text(2, "Informe o bairro"),
  cep: z.string().transform((s) => s.replace(/\D/g, "")).refine((s) => s.length === 8, "CEP deve ter 8 dígitos"),
  city: text(2, "Informe a cidade"),
  stateRegistration: z.string().trim().toUpperCase().refine((s) => s === "ISENTO" || /^\d{2,14}$/.test(s.replace(/\D/g, "")) && !/[A-Z]/.test(s), "Use só os dígitos da IE ou ISENTO")
    .transform((s) => (s === "ISENTO" ? s : s.replace(/\D/g, ""))),
  municipalRegistration: z.string().trim().max(15, "Até 15 caracteres").refine((s) => s === "" || /^[0-9A-Za-z./-]+$/.test(s), "Use números, letras, ponto, barra ou hífen"),
});

// Tabelas do layout NF-e 4.00 (códigos de formato, não enquadramento). O responsável fiscal escolhe; nenhuma tem padrão.
// ponytail: conferir rótulos e códigos com o Manual de Orientação do Contribuinte vigente.
export const IND_FINAL = { "0": "Não (operação normal)", "1": "Sim, consumidor final" } as const;
export const IND_PRES = {
  "0": "Não se aplica", "1": "Presencial", "2": "Pela internet", "3": "Teleatendimento", "5": "Presencial, fora do estabelecimento", "9": "Outros",
} as const;
export const FIN_NFE = { "1": "Normal", "2": "Complementar", "3": "Ajuste", "4": "Devolução" } as const;
export const MOD_FRETE = {
  "0": "Por conta do remetente (CIF)", "1": "Por conta do destinatário (FOB)", "2": "Por conta de terceiros",
  "3": "Transporte próprio do remetente", "4": "Transporte próprio do destinatário", "9": "Sem frete",
} as const;
export const IND_IE_DEST = { "1": "Contribuinte do ICMS", "2": "Contribuinte isento de inscrição", "9": "Não contribuinte" } as const;

type FieldDef = { key: string; label: string; schema?: z.ZodType; options?: Record<string, string> };
const enumOf = (o: Record<string, string>) => z.enum(Object.keys(o) as [string, ...string[]], "Selecione");
export const fieldSchema = (f: FieldDef) => f.schema ?? enumOf(f.options!);

export const NFE_FIELDS = [
  { key: "natOp", label: "Natureza da operação", schema: text(3, "Informe a natureza da operação") },
  { key: "cfop", label: "CFOP", schema: req(/^\d{4}$/, "CFOP tem 4 dígitos") },
  { key: "ncm", label: "NCM", schema: req(/^\d{8}$/, "NCM tem 8 dígitos") },
  { key: "origem", label: "Origem da mercadoria", schema: req(/^\d$/, "Origem é 1 dígito") },
  { key: "cstIcms", label: "CST ou CSOSN do ICMS", schema: req(/^\d{2,3}$/, "2 ou 3 dígitos") },
  { key: "cstPis", label: "CST do PIS", schema: req(/^\d{2}$/, "2 dígitos") },
  { key: "cstCofins", label: "CST da COFINS", schema: req(/^\d{2}$/, "2 dígitos") },
  { key: "indFinal", label: "Consumidor final (indFinal)", options: IND_FINAL },
  { key: "indPres", label: "Presença do comprador (indPres)", options: IND_PRES },
  { key: "finNFe", label: "Finalidade da NF-e (finNFe)", options: FIN_NFE },
  { key: "modFrete", label: "Modalidade do frete (modFrete)", options: MOD_FRETE },
  { key: "indIEDest", label: "Destinatário quanto ao ICMS (indIEDest)", options: IND_IE_DEST },
  { key: "infCpl", label: "Informações complementares (opcional)", schema: z.string().trim().max(2000) },
] as const;

export const RETENCAO_ISS = { "1": "Não retido", "2": "Retido pelo tomador", "3": "Retido pelo intermediário" } as const;

export const NFSE_FIELDS = [
  { key: "cTribNac", label: "Código de tributação nacional", schema: req(/^\d{6}$/, "6 dígitos") },
  { key: "cTribMun", label: "Código de tributação municipal (opcional)", schema: opt(/^\d{3}$/, "3 dígitos") },
  { key: "aliquotaIss", label: "Alíquota do ISS em % (opcional)", schema: opt(/^\d{1,2}(,\d{1,2})?$/, "Ex.: 2,00") },
  { key: "retencaoIss", label: "Retenção do ISS", options: RETENCAO_ISS },
  // Códigos da NFS-e nacional digitados como no manual (sem rótulos aqui para não induzir escolha errada).
  { key: "tribIssqn", label: "Tributação do ISSQN (tribISSQN)", schema: req(/^\d$/, "1 dígito, conforme o manual da NFS-e nacional") },
  { key: "opSimpNac", label: "Situação no Simples Nacional (opSimpNac)", schema: req(/^\d$/, "1 dígito, conforme o manual") },
  { key: "regEspTrib", label: "Regime especial de tributação (regEspTrib)", schema: req(/^\d$/, "1 dígito, conforme o manual") },
  { key: "cNbs", label: "Código NBS (opcional)", schema: opt(/^\d{9}$/, "9 dígitos") },
  // IBS/CBS no grupo IBSCBS da DPS (Anexo VI v1.04.01 / NT 009). Opcionais até o contador definir se e quando se aplicam;
  // .optional(): regra aprovada antes destes campos continua completa (não bloqueia pedidos por campo opcional).
  { key: "ibsCbsIndFinal", label: "IBS/CBS · consumo pessoal (indFinal, opcional)", schema: opt(/^[01]$/, "0 ou 1").optional() },
  { key: "ibsCbsCIndOp", label: "IBS/CBS · indicador da operação (cIndOp, opcional)", schema: opt(/^\d{6}$/, "6 dígitos (Anexo VII)").optional() },
  { key: "ibsCbsCst", label: "IBS/CBS · CST (opcional)", schema: opt(/^\d{3}$/, "3 dígitos").optional() },
  { key: "ibsCbsCClassTrib", label: "IBS/CBS · cClassTrib (opcional)", schema: opt(/^\d{6}$/, "6 dígitos").optional() },
] as const;


const paramsSchema = (fields: readonly FieldDef[]) => z.object(Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f)])));

const common = {
  ufDestino: z.union([z.literal(""), z.enum(UFS)]),
  // Pedido ainda não informa município à resolução: regra com município nunca seria aplicada. Recusar, não ignorar.
  municipioIbge: z.literal("", "Regra por município ainda não é suportada (pendência fiscal: definir município da prestação ou da entrega)."),
  validFrom: date,
  validTo: z.union([z.literal(""), date]),
  justification: text(10, "Explique a origem da regra (mín. 10 caracteres), ex.: parecer do contador de 10/11/2026"),
};

/** Parâmetros da regra atendem ao formato atual? Regra aprovada antes de um campo novo fica incompleta. */
export function paramsComplete(docType: "NFE" | "NFSE", params: unknown): boolean {
  return paramsSchema(docType === "NFE" ? NFE_FIELDS : NFSE_FIELDS).safeParse(params).success;
}

export const ruleSchema = z
  .discriminatedUnion("docType", [
    z.object({ docType: z.literal("NFE"), purpose: z.literal("album"), params: paramsSchema(NFE_FIELDS), ...common }),
    z.object({ docType: z.literal("NFSE"), purpose: z.literal("servico-fotografico"), params: paramsSchema(NFSE_FIELDS), ...common }),
  ])
  .refine((r) => r.validTo === "" || r.validTo > r.validFrom, { path: ["validTo"], message: "Fim da vigência deve ser depois do início" });

export type RuleInput = z.output<typeof ruleSchema>;
