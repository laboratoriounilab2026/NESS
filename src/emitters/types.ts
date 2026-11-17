import type { DocType } from "@/domain/states";

// Contrato que os adaptadores reais (NF-e/SEFAZ, NFS-e/Sefin Nacional) implementarão nas Fases 4 e 5.

export type EmitRequest = { documentId: string; docType: DocType; idempotencyKey: string };

export type SendResult =
  | { kind: "authorized"; accessKey: string; protocol: string }
  | { kind: "rejected"; code: string; message: string }
  | { kind: "denied"; code: string; message: string }
  | { kind: "timeout" }; // sem resposta: NÃO significa rejeição nem autorização

export type QueryResult =
  | { kind: "authorized"; accessKey: string; protocol: string }
  | { kind: "rejected"; code: string; message: string }
  | { kind: "not_found" } // o governo confirma que não recebeu: pode reenviar
  | { kind: "unknown" }; // consulta também falhou: continua incerto

export interface EmitterAdapter {
  send(req: EmitRequest): Promise<SendResult>;
  /** Consulta pela mesma chave da tentativa (reconciliação após timeout). */
  query(req: EmitRequest): Promise<QueryResult>;
}
