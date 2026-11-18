import { afterAll } from "vitest";

// Fecha a conexão ao fim de cada arquivo: o Postgres embutido do `prisma dev` trava
// quando processos de teste terminam com a conexão aberta.
afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/db");
  await db.$disconnect();
});
