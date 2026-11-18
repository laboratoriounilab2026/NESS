import "server-only";
import { loadA1, readyToSign, CertificateError, type A1Certificate, type Usability } from "./certificate";

// Onde o .pfx e a senha ficam: variáveis de ambiente secretas da hospedagem (todas oferecem), por referência:
//   NESS_CERT_<REF>_PFX       = .pfx em base64
//   NESS_CERT_<REF>_PASSWORD  = senha
// O banco guarda só <REF> (Establishment.certSecretRef). ponytail: trocar esta leitura por um secret manager
// dedicado (Vault, AWS/GCP Secret Manager) muda só esta função.

export const CERT_REF = /^[A-Z0-9_]{1,40}$/;

export type CertificateStatus =
  | { ok: true; a1: A1Certificate; usability: Extract<Usability, { ok: true }> }
  | { ok: false; reason: string };

export function loadEstablishmentCertificate(e: { cnpj: string; certSecretRef: string | null }, env: Record<string, string | undefined> = process.env, now = new Date()): CertificateStatus {
  if (!e.certSecretRef) return { ok: false, reason: "Certificado A1 não configurado para o estabelecimento." };
  if (!CERT_REF.test(e.certSecretRef)) return { ok: false, reason: "Referência do certificado inválida." };
  const pfx = env[`NESS_CERT_${e.certSecretRef}_PFX`];
  const password = env[`NESS_CERT_${e.certSecretRef}_PASSWORD`];
  if (!pfx || password === undefined) return { ok: false, reason: "Segredo do certificado não encontrado no ambiente (arquivo ou senha)." };
  let a1: A1Certificate;
  try {
    a1 = loadA1(Buffer.from(pfx, "base64"), password);
  } catch (err) {
    return { ok: false, reason: err instanceof CertificateError ? err.message : "Não foi possível abrir o certificado A1." };
  }
  const u = readyToSign(a1, e.cnpj, now);
  return u.ok ? { ok: true, a1, usability: u } : { ok: false, reason: u.reason };
}
