import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { loadEstablishmentCertificate } from "./certificate-source";

// .pfx gerado na hora, titular fictício; o "ambiente" é um objeto do teste (nada em process.env nem no repositório).
function pfxBase64(cnpj: string, password: string): string {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "02";
  cert.validity.notBefore = new Date("2026-01-01");
  cert.validity.notAfter = new Date("2027-01-01");
  cert.setSubject([{ name: "commonName", value: `ESTUDIO TESTE:${cnpj}` }]);
  cert.setIssuer([{ name: "commonName", value: "AC TESTE" }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return forge.util.encode64(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des" })).getBytes());
}

const now = new Date("2026-11-18T12:00:00Z");
const senha = `teste-${crypto.randomUUID()}`;
const env = { NESS_CERT_ESTUDIO_PFX: pfxBase64("00000000000000", senha), NESS_CERT_ESTUDIO_PASSWORD: senha };

describe("certificado do estabelecimento", () => {
  it("carrega pela referência e confere CNPJ e validade", () => {
    const r = loadEstablishmentCertificate({ cnpj: "00000000000000", certSecretRef: "ESTUDIO" }, env, now);
    expect(r).toMatchObject({ ok: true, usability: { ok: true } });
  });

  it("explica cada falha sem expor o segredo", () => {
    const cases: [Parameters<typeof loadEstablishmentCertificate>[0], Record<string, string>, RegExp][] = [
      [{ cnpj: "00000000000000", certSecretRef: null }, env, /não configurado/],
      [{ cnpj: "00000000000000", certSecretRef: "a-b" }, env, /Referência/],
      [{ cnpj: "00000000000000", certSecretRef: "OUTRO" }, env, /não encontrado/],
      [{ cnpj: "00000000000000", certSecretRef: "ESTUDIO" }, { ...env, NESS_CERT_ESTUDIO_PASSWORD: "errada" }, /senha incorreta/],
      [{ cnpj: "11222333000181", certSecretRef: "ESTUDIO" }, env, /outro CNPJ/],
    ];
    for (const [e, en, re] of cases) {
      const r = loadEstablishmentCertificate(e, en, now);
      expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(re) });
      expect(JSON.stringify(r)).not.toContain(senha);
    }
  });
});
