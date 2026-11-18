import "server-only";
import type { db } from "@/lib/db";

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Trava por pedido até o fim da transação. Serializa envio, descarte, correção de destinatário e reverificação de
 * regras do mesmo pedido: sem ela, uma decisão poderia ser tomada sobre um estado que outra acabou de mudar.
 */
export const lockOrder = (tx: Tx, orderId: string) => tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`order:${orderId}`}))`;
