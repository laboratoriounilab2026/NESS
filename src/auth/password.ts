import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from "node:crypto";

// scrypt da stdlib (sem dependência nova). Formato: scrypt$N$r$p$salt$hash (base64url).
const N = 16384, R = 8, P = 1, KEYLEN = 64;

const derive = (pw: BinaryLike, salt: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((ok, fail) => scrypt(pw, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? fail(e) : ok(k))));

export const MIN_PASSWORD = 12;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD) throw new Error(`Senha precisa de ao menos ${MIN_PASSWORD} caracteres`);
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}
