import type { Instrumentation } from "next";

// Uma linha JSON por erro de servidor, com o mesmo digest exibido na tela de erro (src/app/error.tsx).
// Sem mensagem, stack, headers nem query string: podem carregar CPF/CNPJ, endereço ou token (CLAUDE.md › Segurança).
// ponytail: stdout; ligar a um coletor (Sentry/OTel) quando a hospedagem for definida (Fase 7).
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const e = error as { digest?: string; name?: string; code?: string };
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      digest: e.digest ?? null,
      name: e.name ?? "Error",
      code: typeof e.code === "string" ? e.code : null, // ex.: P2002 do Prisma, sem os valores
      method: request.method,
      path: request.path.split("?")[0],
      routeType: context.routeType,
      routePath: context.routePath,
    }),
  );
};
