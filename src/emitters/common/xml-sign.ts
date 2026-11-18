import "server-only";
import { SignedXml } from "xml-crypto";

// Assinatura XMLDSig no padrão das notas eletrônicas (NF-e 4.00 e DPS nacional):
// assinatura envelopada, RSA-SHA1, digest SHA1, C14N 1.0, referência ao Id do elemento assinado,
// <Signature> logo depois desse elemento e KeyInfo com o certificado X509.
// ponytail: algoritmos fixos do layout; conferir contra o manual/XSD vigente ao ligar cada emissor (Fases 4/5).
// A chave e o certificado chegam por parâmetro (secret manager); nunca são lidos de arquivo nem logados aqui.

const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

export type SigningKey = {
  privateKeyPem: string;
  /** Certificado X509 em base64 (DER), sem cabeçalhos PEM, como vai no <X509Certificate>. */
  certificateBase64: string;
};

const xpathFor = (id: string) => {
  // Id vem do nosso próprio layout (ex.: "NFe3526…", "DPS1234…"); restringe para não montar XPath com texto arbitrário.
  if (!/^[A-Za-z0-9]{1,60}$/.test(id)) throw new Error("Id do elemento assinado inválido");
  return `//*[@Id='${id}']`;
};

/** Assina o elemento com o Id informado e devolve o XML com <Signature> logo após ele. */
export function signXml(xml: string, elementId: string, key: SigningKey): string {
  const ref = xpathFor(elementId);
  const cert = key.certificateBase64.replace(/-----[^-]+-----|\s/g, "");
  const sig = new SignedXml({
    privateKey: key.privateKeyPem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N,
    getKeyInfoContent: () => `<X509Data><X509Certificate>${cert}</X509Certificate></X509Data>`,
  });
  sig.addReference({ xpath: ref, digestAlgorithm: SHA1, transforms: [ENVELOPED, C14N] });
  sig.computeSignature(xml, { location: { reference: ref, action: "after" } });
  return sig.getSignedXml();
}

/** Confere a assinatura com a chave pública (PEM). Usado em testes e para validar retornos assinados. */
export function verifyXml(signedXml: string, publicKeyPem: string): boolean {
  const sig = new SignedXml({ publicCert: publicKeyPem, getCertFromKeyInfo: () => null });
  const node = /<Signature[\s\S]*?<\/Signature>/.exec(signedXml)?.[0];
  if (!node) return false;
  sig.loadSignature(node);
  try {
    return sig.checkSignature(signedXml);
  } catch {
    return false;
  }
}
