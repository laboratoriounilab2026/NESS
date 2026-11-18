import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem banco local: testes de integração são pulados
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  // Testes de integração compartilham o mesmo banco: arquivos em sequência evitam corrida entre eles.
  test: { include: ["src/**/*.test.ts"], fileParallelism: false, setupFiles: ["src/test/setup.ts"] },
});
