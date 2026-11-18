"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/audit/audit";
import { requireUser } from "@/auth/session";
import { issuesByPath } from "@/domain/order-input";
import { establishmentDataSchema, establishmentSchema, numberingSchema, ruleSchema } from "@/fiscal/rule-input";
import { CERT_REF, loadEstablishmentCertificate } from "@/emitters/common/certificate-source";
import { refreshOrderRules } from "@/fiscal/resolve-order";
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

/** Dados cadastrais da empresa para as notas (endereço, IE, IM). Editáveis pelo ADMIN; cada alteração é auditada. */
export async function updateEstablishmentData(_prev: FormState, raw: unknown): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const id = String((raw as Record<string, unknown> | null)?.id ?? "");
  const parsed = establishmentDataSchema.safeParse(raw);
  if (!parsed.success) return { errors: issuesByPath(parsed.error) };
  const d = parsed.data;
  const { count } = await db.establishment.updateMany({ where: { id }, data: { ...d, municipalRegistration: d.municipalRegistration || null } });
  await audit({
    actor: user.id, action: "estabelecimento.dados", entity: "Establishment", entityId: id, result: count === 1 ? "atualizado" : "ignorado",
    correlationId: crypto.randomUUID(), data: { campos: Object.keys(d).join(",") },
  });
  if (count !== 1) return { errors: { _: "Estabelecimento não encontrado." } };
  revalidatePath(PATH);
  return { ok: "Dados da empresa salvos." };
}

/** Define série e próximo número (NF-e ou DPS) UMA vez. Depois não muda pela tela (evita buraco ou volta na sequência). */
export async function configureNumbering(_prev: FormState, raw: unknown): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (r.confirm !== "on") return { errors: { _: "Confirme que conferiu série e número com a última nota emitida." } };
  const parsed = numberingSchema.safeParse(raw);
  if (!parsed.success) return { errors: issuesByPath(parsed.error) };
  const { kind, series, nextNumber } = parsed.data;
  const { count } =
    kind === "NFE"
      ? await db.establishment.updateMany({ where: { id, nfeSeries: null }, data: { nfeSeries: series, nfeNextNumber: nextNumber } })
      : await db.establishment.updateMany({ where: { id, dpsSeries: null }, data: { dpsSeries: series, dpsNextNumber: nextNumber } });
  await audit({
    actor: user.id, action: kind === "NFE" ? "estabelecimento.numeracao_nfe" : "estabelecimento.numeracao_dps", entity: "Establishment", entityId: id,
    result: count === 1 ? "sucesso" : "ignorada", correlationId: crypto.randomUUID(), data: { serie: series, proximo: nextNumber },
  });
  if (count !== 1) return { errors: { _: "Numeração já configurada ou estabelecimento não encontrado." } };
  revalidatePath(PATH);
  return { ok: `Numeração da ${kind === "NFE" ? "NF-e" : "DPS (NFS-e)"} configurada.` };
}

/** Liga o estabelecimento ao segredo do certificado A1 pelo NOME da referência (o arquivo e a senha ficam no ambiente). */
export async function setCertificateRef(_prev: FormState, raw: unknown): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = String(r.id ?? "");
  const ref = String(r.ref ?? "").trim().toUpperCase();
  if (!CERT_REF.test(ref)) return { errors: { ref: "Use letras, números e _ (até 40), ex.: ESTUDIO_SP" } };
  const e = await db.establishment.findUnique({ where: { id }, select: { cnpj: true } });
  if (!e) return { errors: { _: "Estabelecimento não encontrado." } };
  await db.establishment.update({ where: { id }, data: { certSecretRef: ref } });
  const status = loadEstablishmentCertificate({ cnpj: e.cnpj, certSecretRef: ref });
  await audit({
    actor: user.id, action: "estabelecimento.certificado", entity: "Establishment", entityId: id, result: status.ok ? "valido" : "pendente",
    correlationId: crypto.randomUUID(), data: { ref },
  });
  revalidatePath(PATH);
  return status.ok ? { ok: "Certificado encontrado e válido para este CNPJ." } : { errors: { _: `Referência salva, mas: ${status.reason}` } };
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
  const correlationId = crypto.randomUUID();
  await audit({ actor: user.id, action: "regra_fiscal.aprovar", entity: "FiscalRule", entityId: id, result: count === 1 ? "aprovada" : "ignorada", correlationId });
  if (count !== 1) return { errors: { _: "Regra não encontrada ou já aprovada." } };

  // Pedidos bloqueados da empresa são reverificados: os que passam a ter as duas regras ficam prontos para emitir
  // (emitir continua exigindo confirmação humana). ponytail: laço simples; fila se houver milhares de bloqueados.
  const rule = await db.fiscalRule.findUniqueOrThrow({ where: { id }, select: { establishmentId: true } });
  const blocked = await db.emissionOrder.findMany({ where: { establishmentId: rule.establishmentId, state: "BLOQUEADO" }, select: { id: true } });
  let released = 0;
  for (const o of blocked) {
    const r = await refreshOrderRules(o.id);
    if (r.NFSE.status === "ok" && r.NFE.status === "ok") released++;
  }
  if (blocked.length) {
    await audit({ actor: user.id, action: "pedido.reverificar_regras", entity: "FiscalRule", entityId: id, result: "lote", correlationId, data: { bloqueados: blocked.length, liberados: released } });
  }
  revalidatePath(PATH);
  return { ok: released ? `Regra aprovada. ${released} ${released === 1 ? "pedido bloqueado ficou pronto" : "pedidos bloqueados ficaram prontos"} para emitir.` : "Regra aprovada." };
}
