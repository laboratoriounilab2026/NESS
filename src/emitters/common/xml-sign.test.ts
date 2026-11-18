import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signXml, verifyXml } from "./xml-sign";

// Chave gerada na hora do teste: nenhum certificado ou chave real (nem fictícia) fica no repositório.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = { privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), certificateBase64: "Q0VSVElGSUNBRE8tREUtVEVTVEU=" };
const pub = publicKey.export({ type: "spki", format: "pem" }).toString();

const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe123" versao="4.00"><ide><nNF>1</nNF></ide></infNFe></NFe>`;

describe("assinatura XMLDSig", () => {
  it("assina com Signature logo após o elemento e verifica com a chave pública", () => {
    const signed = signXml(xml, "NFe123", key);
    expect(signed).toMatch(/<\/infNFe><Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">/);
    expect(signed).toContain('<Reference URI="#NFe123">');
    expect(signed).toContain("rsa-sha1");
    expect(signed).toContain("<X509Certificate>Q0VSVElGSUNBRE8tREUtVEVTVEU=</X509Certificate>");
    expect(verifyXml(signed, pub)).toBe(true);
  });

  it("qualquer alteração depois de assinar invalida a assinatura", () => {
    const signed = signXml(xml, "NFe123", key);
    expect(verifyXml(signed.replace("<nNF>1</nNF>", "<nNF>2</nNF>"), pub)).toBe(false);
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(verifyXml(signed, other)).toBe(false);
  });

  it("recusa Id fora do padrão (não monta XPath com texto arbitrário)", () => {
    expect(() => signXml(xml, "x' or '1'='1", key)).toThrow(/Id/);
  });
});
