import "server-only";
import forge from "node-forge";
import type { SigningKey } from "./xml-sign";

// Certificado A1 (.pfx / PKCS#12) do estabelecimento. O arquivo e a senha vêm do secret manager (ref em
// Establishment.certSecretRef); este módulo só os transforma em memória. Nunca registra senha, chave ou o
// conteúdo do certificado; erros saem com mensagens genéricas.

export type A1Certificate = SigningKey & {
  certificatePem: string; // para mTLS (https.Agent { key, cert })
  subject: string; // CN do titular (ex.: "EMPRESA LTDA:12345678000199"), para conferir com o CNPJ do estabelecimento
  notBefore: Date;
  notAfter: Date;
};

export class CertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateError";
  }
}

/** Abre o .pfx. Senha errada ou arquivo inválido → CertificateError genérico (sem detalhes do conteúdo). */
export function loadA1(pfx: Uint8Array, password: string): A1Certificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.binary.raw.encode(pfx));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw new CertificateError("Não foi possível abrir o certificado A1: senha incorreta ou arquivo inválido.");
  }
  const key = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
    ?? p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0]?.key;
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map((b) => b.cert).filter((c): c is forge.pki.Certificate => !!c);
  // Certificado do titular = o que corresponde à chave privada (o .pfx pode trazer a cadeia junto).
  const cert = key && certs.find((c) => forge.pki.publicKeyToPem(c.publicKey) === forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey((key as forge.pki.rsa.PrivateKey).n, (key as forge.pki.rsa.PrivateKey).e)));
  if (!key || !cert) throw new CertificateError("O arquivo não contém chave privada e certificado correspondentes.");

  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return {
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certificatePem: forge.pki.certificateToPem(cert),
    certificateBase64: forge.util.encode64(der),
    subject: String(cert.subject.getField("CN")?.value ?? ""),
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
  };
}

export type Usability = { ok: true; expiresInDays: number; warn: boolean } | { ok: false; reason: string };

/** Certificado fora da validade não assina nada. Aviso com antecedência para renovar sem parar a emissão. */
export function checkValidity(c: Pick<A1Certificate, "notBefore" | "notAfter">, now = new Date(), warnDays = 30): Usability {
  if (now < c.notBefore) return { ok: false, reason: "O certificado A1 ainda não está válido." };
  if (now >= c.notAfter) return { ok: false, reason: "O certificado A1 está vencido. Renove antes de emitir." };
  const expiresInDays = Math.floor((c.notAfter.getTime() - now.getTime()) / 86_400_000);
  return { ok: true, expiresInDays, warn: expiresInDays <= warnDays };
}
