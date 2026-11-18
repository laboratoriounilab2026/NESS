import { audit } from "@/audit/audit";
import { requireUser } from "@/auth/session";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const brl = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const when = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/**
 * Notas autorizadas no mês (horário de Brasília) em CSV para o contador.
 * Sem CPF/CNPJ do tomador (minimização: a chave de acesso identifica a nota). Cada exportação é auditada.
 */
export async function GET(request: Request) {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const mes = new URL(request.url).searchParams.get("mes") ?? "";
  const m = MONTH.exec(mes);
  if (!m) return new Response("Informe o mês como AAAA-MM.", { status: 400 });

  // Brasil sem horário de verão desde 2019: mês começa às 03:00 UTC.
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 3));
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1, 3));
  const docs = await db.emissionDocument.findMany({
    where: { accessKey: { not: null }, attempts: { some: { resultState: "AUTORIZADO", finishedAt: { gte: start, lt: end } } } },
    include: {
      order: { select: { serviceCents: true, goodsCents: true, customer: { select: { name: true } } } },
      attempts: { where: { resultState: "AUTORIZADO" }, orderBy: { finishedAt: "asc" }, take: 1, select: { finishedAt: true } },
      nfeNumber: { select: { series: true, number: true } },
      dpsNumber: { select: { series: true, number: true } },
    },
  });
  docs.sort((a, b) => (a.attempts[0]?.finishedAt?.getTime() ?? 0) - (b.attempts[0]?.finishedAt?.getTime() ?? 0));

  const csv = toCsv(
    ["Autorizada em", "Documento", "Número", "Série", "Chave de acesso", "Protocolo", "Situação atual", "Cliente", "Valor (R$)"],
    docs.map((d) => {
      const n = d.nfeNumber ?? d.dpsNumber;
      return [
        d.attempts[0]?.finishedAt ? when(d.attempts[0].finishedAt) : "",
        d.type === "NFE" ? "NF-e" : "NFS-e",
        n?.number ?? "",
        n?.series ?? "",
        d.accessKey,
        d.protocol,
        d.state === "AUTORIZADO" ? "Autorizada" : d.state === "CANCELADO" ? "Cancelada" : d.state,
        d.order.customer.name,
        brl(d.type === "NFE" ? d.order.goodsCents : d.order.serviceCents),
      ];
    }),
  );
  await audit({ actor: user.id, action: "documentos.exportar", entity: "EmissionDocument", entityId: mes, result: "sucesso", correlationId: crypto.randomUUID(), data: { mes, notas: docs.length } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="notas-autorizadas-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
