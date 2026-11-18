/**
 * Destino pós-login vindo do link original. Só caminho interno ("/pedidos/…"):
 * recusa URL absoluta, "//host" e "/\host" (navegadores tratam como outro site), espaços e o próprio /login.
 */
export function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const internal = s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") && !/[\s\\]/.test(s);
  return internal && !s.startsWith("/login") ? s : "/";
}
