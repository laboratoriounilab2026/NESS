import "server-only";
import { db } from "@/lib/db";
import type { Tx } from "@/lib/order-lock";

export type Reservation = { ok: true; series: number; number: number } | { ok: false; reason: string };

// Uma tabela de números usados por documento: NF-e (NfeNumber) e DPS da NFS-e (DpsNumber).
const KIND = {
  NFE: {
    label: "NF-e",
    find: (documentId: string) => db.nfeNumber.findUnique({ where: { documentId } }),
    next: (tx: Tx, establishmentId: string) => tx.$queryRaw<{ series: number; number: number }[]>`
      UPDATE "Establishment" SET "nfeNextNumber" = "nfeNextNumber" + 1
      WHERE id = ${establishmentId} AND "nfeSeries" IS NOT NULL AND "nfeNextNumber" IS NOT NULL
      RETURNING "nfeSeries" AS series, "nfeNextNumber" - 1 AS number`,
    save: (tx: Tx, data: { establishmentId: string; series: number; number: number; documentId: string }) => tx.nfeNumber.create({ data }),
  },
  NFSE: {
    label: "DPS (NFS-e)",
    find: (documentId: string) => db.dpsNumber.findUnique({ where: { documentId } }),
    next: (tx: Tx, establishmentId: string) => tx.$queryRaw<{ series: number; number: number }[]>`
      UPDATE "Establishment" SET "dpsNextNumber" = "dpsNextNumber" + 1
      WHERE id = ${establishmentId} AND "dpsSeries" IS NOT NULL AND "dpsNextNumber" IS NOT NULL
      RETURNING "dpsSeries" AS series, "dpsNextNumber" - 1 AS number`,
    save: (tx: Tx, data: { establishmentId: string; series: number; number: number; documentId: string }) => tx.dpsNumber.create({ data }),
  },
} as const;

/**
 * Reserva (série, número) para a nota (NF-e ou DPS da NFS-e). Regras (docs/ARQUITETURA.md › Numeração):
 * - reserva no primeiro envio, não ao salvar o pedido (pedido não emitido não consome número);
 * - idempotente por nota: nova tentativa (após rejeição/consulta) reusa o mesmo número;
 * - incremento atômico no banco; (estabelecimento, série, número) é chave primária, nunca repete.
 */
export async function reserveNumber(documentId: string): Promise<Reservation> {
  const doc = await db.emissionDocument.findUniqueOrThrow({ where: { id: documentId }, select: { type: true, order: { select: { establishmentId: true } } } });
  const k = KIND[doc.type];
  const existing = await k.find(documentId);
  if (existing) return { ok: true, series: existing.series, number: existing.number };
  const establishmentId = doc.order.establishmentId;

  try {
    return await db.$transaction(async (tx) => {
      const rows = await k.next(tx, establishmentId);
      if (rows.length === 0) return { ok: false, reason: `Série e próximo número da ${k.label} não configurados para o estabelecimento.` } as const;
      const { series, number } = rows[0];
      await k.save(tx, { establishmentId, series, number, documentId });
      return { ok: true, series, number } as const;
    });
  } catch (e) {
    // Corrida na mesma nota: a outra transação gravou primeiro; esta foi desfeita (contador incluso).
    const won = await k.find(documentId);
    if (won) return { ok: true, series: won.series, number: won.number };
    throw e;
  }
}
