"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/audit/audit";
import { requireUser } from "@/auth/session";
import { issuesByPath } from "@/domain/order-input";
import { establishmentSchema, nfeNumberingSchema, ruleSchema } from "@/fiscal/rule-input";
import { db } from "@/lib/db";

export type FormState = { ok?: string; errors?: Record<string, string> };

const PATH = "/configuracao-fiscal";

export async function createEstablishment(_prev: FormState, raw: unknown): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const parsed = establishmentSchema.safeParse(raw);
  if (!parsed.success) return { errors: issuesByPath(parsed.error) };
  const cnpj = parsed.data.cnpj.toUpperCase().replace(/[^0-9A-Z]/g, "");

  if (await db.establishment.findUnique({ where: { cnpj } })) return { errors: { cnpj: "Já existe estabelecimento com esse CNPJ" } };
  // Sempre nasce em HOMOLOGAÇÃO. Produção exige autorização explícita fora desta tela.
  const e = await db.establishment.create({ data: { ...parsed.data, cnpj, environment: "HOMOLOGACAO" } });
  await audit({
    actor: user.id, action: "estabelecimento.criar", entity: "Establishment", entityId: e.id, result: "sucesso",
    correlationId: crypto.randomUUID(), data: { uf: e.uf, regime: e.regime },
  });
  revalidatePath(PATH);
  return { ok: "Estabelecimento cadastrado em homologação." };
}

/** Define série e próximo número da NF-e UMA vez. Depois disso não muda pela tela (evita buraco ou volta na sequência). */
export async function configureNfeNumbering(_prev: FormState, raw: unknown): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (r.confirm !== "on") return { errors: { _: "Confirme que conferiu série e número com a última NF-e emitida." } };
  const parsed = nfeNumberingSchema.safeParse(raw);
  if (!parsed.success) return { errors: issuesByPath(parsed.error) };
  const { count } = await db.establishment.updateMany({ where: { id, nfeSeries: null }, data: parsed.data });
  await audit({
    actor: user.id, action: "estabelecimento.numeracao_nfe", entity: "Establishment", entityId: id, result: count === 1 ? "sucesso" : "ignorada",
    correlationId: crypto.randomUUID(), data: { serie: parsed.data.nfeSeries, proximo: parsed.data.nfeNextNumber },
  });
  if (count !== 1) return { errors: { _: "Numeração já configurada ou estabelecimento não encontrado." } };
  revalidatePath(PATH);
  return { ok: "Numeração da NF-e configurada." };
}

export async function createRule(_prev: FormState, raw: unknown): Promise<FormState> {
  const user = await requireUser("FISCAL");
  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) return { errors: issuesByPath(parsed.error) };
  const r = parsed.data;

  // ponytail: estabelecimento único (como em checkOrder); seleção explícita entra com multiempresa.
  const establishments = await db.establishment.findMany({ select: { id: true }, take: 2 });
  if (establishments.length !== 1) return { errors: { _: "Cadastre exatamente um estabelecimento antes das regras." } };
  const establishmentId = establishments[0].id;

  const scope = {
    establishmentId, docType: r.docType, purpose: r.purpose,
    ufDestino: r.ufDestino || null, municipioIbge: r.municipioIbge || null,
  };
  const last = await db.fiscalRule.findFirst({ where: scope, orderBy: { version: "desc" }, select: { version: true } });
  const rule = await db.fiscalRule.create({
    data: {
      ...scope,
      version: (last?.version ?? 0) + 1,
      params: r.params as Record<string, string>, // todos os campos são strings validadas pelo ruleSchema
      validFrom: new Date(`${r.validFrom}T00:00:00-03:00`),
      validTo: r.validTo ? new Date(`${r.validTo}T00:00:00-03:00`) : null,
      justification: r.justification,
      createdBy: user.id,
    },
  });
  await audit({
    actor: user.id, action: "regra_fiscal.criar", entity: "FiscalRule", entityId: rule.id, result: "aguardando_aprovacao",
    correlationId: crypto.randomUUID(), data: { docType: rule.docType, version: rule.version, ufDestino: rule.ufDestino },
  });
  revalidatePath(PATH);
  return { ok: `Regra v${rule.version} criada. Ela só vale depois de aprovada.` };
}

export async function approveRule(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("FISCAL");
  const id = String(form.get("id") ?? "");
  if (form.get("confirm") !== "on") return { errors: { _: "Confirme que revisou a regra." } };

  // updateMany com approvedAt=null: aprovação única mesmo com dois cliques simultâneos.
  const { count } = await db.fiscalRule.updateMany({ where: { id, approvedAt: null }, data: { approvedAt: new Date(), approvedBy: user.id } });
  await audit({
    actor: user.id, action: "regra_fiscal.aprovar", entity: "FiscalRule", entityId: id,
    result: count === 1 ? "aprovada" : "ignorada", correlationId: crypto.randomUUID(),
  });
  if (count !== 1) return { errors: { _: "Regra não encontrada ou já aprovada." } };
  revalidatePath(PATH);
  return { ok: "Regra aprovada." };
}
