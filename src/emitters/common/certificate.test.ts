import forge from "node-forge";
import { createPublicKey } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkValidity, loadA1 } from "./certificate";
import { signXml, verifyXml } from "./xml-sign";

// .pfx gerado na hora (titular fictício "EMPRESA TESTE"); nada de certificado no repositório.
// ponytail: RSA 1024 só para o teste ser rápido em JS puro; certificados reais usam 2048.
function makePfx(password: string, notBefore: Date, notAfter: Date): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  const attrs = [{ name: "commonName", value: "EMPRESA TESTE:00000000000000" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des" })).getBytes();
  return forge.util.binary.raw.decode(der);
}

const day = 86_400_000;
const now = new Date("2026-11-18T12:00:00Z");
const senha = `teste-${crypto.randomUUID()}`;
const pfx = makePfx(senha, new Date(now.getTime() - day), new Date(now.getTime() + 365 * day));

describe("certificado A1", () => {
  it("abre o .pfx e a chave assina XML verificável pelo certificado", () => {
    const a1 = loadA1(pfx, senha);
    expect(a1.subject).toBe("EMPRESA TESTE:00000000000000");
    const signed = signXml(`<r><a Id="A1">x</a></r>`, "A1", a1);
    expect(signed).toContain(`<X509Certificate>${a1.certificateBase64}</X509Certificate>`);
    const pub = createPublicKey(a1.certificatePem).export({ type: "spki", format: "pem" }).toString();
    expect(verifyXml(signed, pub)).toBe(true);
  });

  it("senha errada: erro genérico, sem a senha nem detalhes do arquivo", () => {
    let msg = "";
    try {
      loadA1(pfx, "senha-errada");
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/senha incorreta ou arquivo inválido/);
    expect(msg).not.toContain("senha-errada");
    expect(() => loadA1(new Uint8Array([1, 2, 3]), senha)).toThrow(/arquivo inválido/);
  });

  it("validade: vencido e ainda não válido bloqueiam; aviso 30 dias antes", () => {
    const c = { notBefore: new Date("2026-01-01"), notAfter: new Date("2026-12-01") };
    expect(checkValidity(c, new Date("2026-12-02"))).toMatchObject({ ok: false, reason: expect.stringMatching(/vencido/) });
    expect(checkValidity(c, new Date("2025-12-31"))).toMatchObject({ ok: false, reason: expect.stringMatching(/ainda não/) });
    expect(checkValidity(c, new Date("2026-11-18"))).toMatchObject({ ok: true, warn: true, expiresInDays: 13 });
    expect(checkValidity(c, new Date("2026-06-01"))).toMatchObject({ ok: true, warn: false });
  });
});
