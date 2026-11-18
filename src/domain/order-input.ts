import { z } from "zod";
import { findMunicipio } from "./municipios";

// Entrada do pedido: mesmo schema no cliente (validação inline) e no servidor (fonte de verdade).
// O operador não informa nenhum parâmetro fiscal técnico — eles vêm da regra aprovada.

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function isValidCpf(raw: string): boolean {
  const c = onlyDigits(raw);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

/** CNPJ numérico ou alfanumérico (IN RFB 2.229/2024): 12 posições [0-9A-Z] + 2 DVs numéricos. */
export function isValidCnpj(raw: string): boolean {
  const c = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += (c.charCodeAt(i) - 48) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

export const isValidDocument = (s: string) => isValidCpf(s) || isValidCnpj(s);

/** "1.234,56" / "R$ 80" → centavos. NaN se inválido. */
export function parseBRL(raw: string): number {
  const s = raw.replace(/R\$|\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

export const formatBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

const money = z.string().transform((s, ctx) => {
  const v = parseBRL(s);
  if (!(v > 0)) ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero, ex.: 1.250,00" });
  return v;
});
const text = (min: number, label: string) => z.string().trim().min(min, `Informe ${label}`).max(200);

/** CPF/CNPJ sem pontuação e em maiúsculas: uma forma só no banco (evita o mesmo cliente duplicado). */
export const normalizeDocument = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");

export const customerSchema = z.object({
  document: z.string().refine(isValidDocument, "CPF ou CNPJ inválido").transform(normalizeDocument),
  name: text(2, "o nome"),
  email: z.union([z.literal(""), z.email("E-mail inválido")]),
});

const recipientFields = z.object({
  same: z.boolean(),
  name: text(2, "o nome de quem recebe"),
  document: z.string().refine((s) => s === "" || isValidDocument(s), "CPF ou CNPJ inválido").transform(normalizeDocument),
  cep: z.string().refine((s) => onlyDigits(s).length === 8, "CEP deve ter 8 dígitos"),
  street: text(2, "a rua"),
  number: text(1, "o número"),
  district: text(2, "o bairro"),
  city: text(2, "a cidade"),
  uf: z.enum(UFS, "Selecione a UF"),
});
// Cidade precisa existir na UF (tabela do IBGE): grava o nome oficial e o código IBGE exigido pela NF-e (dest/cMun).
function withMunicipio<T extends { uf: string; city: string }>(r: T, ctx: z.RefinementCtx) {
  const m = findMunicipio(r.uf, r.city);
  if (!m) {
    ctx.addIssue({ code: "custom", path: ["city"], message: "Cidade não encontrada nesta UF. Escolha da lista." });
    return z.NEVER;
  }
  return { ...r, city: m.name, cityIbge: m.code };
}

export const recipientSchema = recipientFields.transform(withMunicipio);
/** Correção do destinatário no pedido salvo (sem a opção "mesma pessoa"). */
export const recipientEditSchema = recipientFields.omit({ same: true }).transform(withMunicipio);


export const serviceSchema = z.object({ description: text(3, "a descrição do serviço"), value: money });

export const goodsSchema = z.object({
  description: text(3, "a descrição do álbum"),
  quantity: z.coerce.number<string>().int("Quantidade inteira").min(1, "Mínimo 1"),
  unitValue: money,
});

export const orderSchema = z
  .object({ customer: customerSchema, recipient: recipientSchema, service: serviceSchema, goods: goodsSchema })
  // "Mesma pessoa": destinatário sempre derivado do tomador (evita nome/documento antigos se o tomador mudou depois).
  .transform((o) => (o.recipient.same ? { ...o, recipient: { ...o.recipient, name: o.customer.name, document: o.customer.document } } : o));

export type OrderDraft = z.input<typeof orderSchema>;
export type OrderInput = z.output<typeof orderSchema>;

export const EMPTY_DRAFT: OrderDraft = {
  customer: { document: "", name: "", email: "" },
  recipient: { same: false, name: "", document: "", cep: "", street: "", number: "", district: "", city: "", uf: "" as OrderDraft["recipient"]["uf"] },
  service: { description: "", value: "" },
  goods: { description: "", quantity: "1", unitValue: "" },
};

/** Erros por caminho ("customer.document") para exibir inline. */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}
