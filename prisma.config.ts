import { defineConfig } from "prisma/config";

// DATABASE_URL vem de .env.local (fora do git). Sem ela, generate/validate funcionam; migrate não.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: segue com o ambiente atual
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
