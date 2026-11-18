import "server-only";
import { db } from "@/lib/db";
import type { Tx } from "@/lib/order-lock";

export type Reservation = { ok: true; series: number; number: number } | { ok: false; reason: string };

// Uma tabela de números usados por documento: NF-e (NfeNumber) e DPS da NFS-e (DpsNumber).
const KIND = {
  NFE: {
    label: "NF-e",
    find: (c: Tx | typeof db, documentId: string) => c.nfeNumber.findUnique({ where: { documentId } }),
    next: (tx: Tx, establishmentId: string) => tx.$queryRaw<{ series: number; number: number }[]>`
      UPDATE "Establishment" SET "nfeNextNumber" = "nfeNextNumber" + 1
      WHERE id = ${establishmentId} AND "nfeSeries" IS NOT NULL AND "nfeNextNumber" IS NOT NULL
      RETURNING "nfeSeries" AS series, "nfeNextNumber" - 1 AS number`,
    save: (tx: Tx, data: { establishmentId: string; series: number; number: number; documentId: string }) => tx.nfeNumber.create({ data }),
  },
  NFSE: {
    label: "DPS (NFS-e)",
    find: (c: Tx | typeof db, documentId: string) => c.dpsNumber.findUnique({ where: { documentId } }),
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
 * Versão para transação aberta: o envio chama sob a trava do pedido, depois de conferir descarte e regra.
 */
export async function reserveNumberTx(tx: Tx, documentId: string): Promise<Reservation> {
  const doc = await tx.emissionDocument.findUniqueOrThrow({ where: { id: documentId }, select: { type: true, order: { select: { establishmentId: true } } } });
  const k = KIND[doc.type];
  const existing = await k.find(tx, documentId);
  if (existing) return { ok: true, series: existing.series, number: existing.number };
  const establishmentId = doc.order.establishmentId;
  const rows = await k.next(tx, establishmentId);
  if (rows.length === 0) return { ok: false, reason: `Série e próximo número da ${k.label} não configurados para o estabelecimento.` };
  const { series, number } = rows[0];
  await k.save(tx, { establishmentId, series, number, documentId });
  return { ok: true, series, number };
}

/** Reserva em transação própria (fora do envio). Corrida na mesma nota: a perdedora é desfeita e devolve o número da vencedora. */
export async function reserveNumber(documentId: string): Promise<Reservation> {
  try {
    return await db.$transaction((tx) => reserveNumberTx(tx, documentId));
  } catch (e) {
    const doc = await db.emissionDocument.findUniqueOrThrow({ where: { id: documentId }, select: { type: true } });
    const won = await KIND[doc.type].find(db, documentId);
    if (won) return { ok: true, series: won.series, number: won.number };
    throw e;
  }
}

/** Número já reservado da nota, sem reservar outro (usado pela consulta ao emissor). */
export async function findReservedNumber(documentId: string): Promise<{ series: number; number: number } | null> {
  const doc = await db.emissionDocument.findUniqueOrThrow({ where: { id: documentId }, select: { type: true } });
  const r = await KIND[doc.type].find(db, documentId);
  return r ? { series: r.series, number: r.number } : null;
}
