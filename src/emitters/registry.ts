import "server-only";
import type { DocType } from "@/domain/states";
import type { EmitterAdapter } from "./types";

/**
 * Adaptadores REAIS por tipo de nota (Fase 4: NF-e/SEFAZ; Fase 5: NFS-e/Sefin Nacional), sempre em homologação primeiro.
 * Nunca registrar aqui o emissor falso dos testes: a interface não pode mostrar "Autorizada" sem o governo confirmar.
 */
// ponytail: nenhum adaptador real ainda → null bloqueia o envio com explicação.
export function getAdapter(type: DocType): EmitterAdapter | null {
  void type;
  return null;
}
