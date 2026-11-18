"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/audit/audit";
import { requireUser } from "@/auth/session";
import { getAdapter } from "@/emitters/registry";
import { db } from "@/lib/db";
import { emitDocument, reconcileDocument, type Outcome } from "@/orchestrator/emit";

export type ActionResult = { ok: boolean; message: string; docs?: Partial<Record<"NFSE" | "NFE", Outcome>> };

const LABEL = { NFSE: "NFS-e", NFE: "NF-e" } as const;
const EMITTABLE = ["PRONTO_REVISAO", "EMITINDO"] as const;

/** Envia as notas PENDENTES do pedido (NFS-e primeiro). Uma falhar não impede a outra. */
export async function emitOrderAction(orderId: string, confirmed: boolean): Promise<ActionResult> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  if (confirmed !== true) return { ok: false, message: "Confirme a emissão antes de enviar." };

  const order = await db.emissionOrder.findUnique({
    where: { id: orderId },
    include: { documents: { where: { state: "PENDENTE" }, orderBy: { type: "asc" } } },
  });
  if (!order) return { ok: false, message: "Pedido não encontrado." };
  if (!(EMITTABLE as readonly string[]).includes(order.state)) {
    return { ok: false, message: order.state === "BLOQUEADO" ? "Pedido bloqueado: falta regra fiscal aprovada." : "Este pedido não tem notas a emitir." };
  }
  if (order.documents.length === 0) return { ok: false, message: "Nenhuma nota pendente neste pedido." };

  const correlationId = crypto.randomUUID();
  const ctx = { actor: user.id, correlationId };
  const docs: ActionResult["docs"] = {};
  const notConfigured: string[] = [];
  for (const d of order.documents) {
    const adapter = getAdapter(d.type);
    if (!adapter) {
      notConfigured.push(LABEL[d.type]);
      continue;
    }
    docs[d.type] = await emitDocument(d.id, adapter, ctx);
  }
  if (notConfigured.length) {
    await audit({ actor: user.id, action: "pedido.emitir", entity: "EmissionOrder", entityId: orderId, result: "bloqueado", correlationId, data: { semTransmissao: notConfigured.join(",") } });
  }
  revalidatePath(`/pedidos/${orderId}`);

  const sent = Object.keys(docs).length;
  if (sent === 0) {
    return { ok: false, message: `Transmissão ao governo ainda não configurada (${notConfigured.join(", ")}). Nada foi enviado.` };
  }
  return {
    ok: true,
    docs,
    message: notConfigured.length ? `Envio feito para parte das notas. Sem transmissão configurada: ${notConfigured.join(", ")}.` : "Envio concluído. Veja o resultado de cada nota.",
  };
}

/** Consulta o governo sobre notas sem resposta (INCERTO) antes de qualquer reenvio. */
export async function reconcileOrderAction(orderId: string): Promise<ActionResult> {
  const user = await requireUser("OPERADOR", "FISCAL", "ADMIN");
  const docs = await db.emissionDocument.findMany({ where: { orderId, state: "INCERTO" }, orderBy: { type: "asc" } });
  if (docs.length === 0) return { ok: false, message: "Nenhuma nota aguardando confirmação." };
  const ctx = { actor: user.id, correlationId: crypto.randomUUID() };
  const out: ActionResult["docs"] = {};
  for (const d of docs) {
    const adapter = getAdapter(d.type);
    if (adapter) out[d.type] = await reconcileDocument(d.id, adapter, ctx);
  }
  revalidatePath(`/pedidos/${orderId}`);
  return Object.keys(out).length
    ? { ok: true, docs: out, message: "Consulta feita. Veja o estado atualizado de cada nota." }
    : { ok: false, message: "Transmissão ao governo ainda não configurada; não há como consultar." };
}
