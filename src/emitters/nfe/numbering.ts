import "server-only";
import { db } from "@/lib/db";

export type Reservation = { ok: true; series: number; number: number } | { ok: false; reason: string };

/**
 * Reserva (série, número) para uma NF-e. Regras (docs/ARQUITETURA.md › Numeração):
 * - reserva no primeiro envio, não ao salvar o pedido (pedido não emitido não consome número);
 * - idempotente por nota: nova tentativa (após rejeição/consulta) reusa o mesmo número;
 * - incremento atômico no banco; (estabelecimento, série, número) é chave primária, nunca repete.
 */
export async function reserveNfeNumber(documentId: string): Promise<Reservation> {
  const existing = await db.nfeNumber.findUnique({ where: { documentId } });
  if (existing) return { ok: true, series: existing.series, number: existing.number };

  const doc = await db.emissionDocument.findUniqueOrThrow({ where: { id: documentId }, select: { type: true, order: { select: { establishmentId: true } } } });
  if (doc.type !== "NFE") return { ok: false, reason: "Numeração sequencial só se aplica à NF-e." };
  const establishmentId = doc.order.establishmentId;

  try {
    return await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ series: number; number: number }[]>`
        UPDATE "Establishment" SET "nfeNextNumber" = "nfeNextNumber" + 1
        WHERE id = ${establishmentId} AND "nfeSeries" IS NOT NULL AND "nfeNextNumber" IS NOT NULL
        RETURNING "nfeSeries" AS series, "nfeNextNumber" - 1 AS number`;
      if (rows.length === 0) return { ok: false, reason: "Série e próximo número da NF-e não configurados para o estabelecimento." } as const;
      const { series, number } = rows[0];
      await tx.nfeNumber.create({ data: { establishmentId, series, number, documentId } });
      return { ok: true, series, number } as const;
    });
  } catch (e) {
    // Corrida na mesma nota: a outra transação gravou primeiro; esta foi desfeita (contador incluso).
    const won = await db.nfeNumber.findUnique({ where: { documentId } });
    if (won) return { ok: true, series: won.series, number: won.number };
    throw e;
  }
}
