import "server-only";
import { db } from "@/lib/db";

export type AuditInput = {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  result: string;
  correlationId: string;
  data?: Record<string, string | number | boolean | null>; // sem segredos nem dados pessoais completos
};

/** Append-only: a aplicação só insere. Falha de auditoria não é engolida. */
export async function audit(e: AuditInput) {
  await db.auditEvent.create({ data: e });
}
