// Cria usuário pelo terminal (primeiro admin e demais contas). Uso:
//   npm run user:create -- email@empresa.com "Nome Completo" ADMIN|FISCAL|OPERADOR
// A senha é digitada no terminal (sem eco) e nunca aparece em argumentos, histórico ou log.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword, MIN_PASSWORD } from "../src/auth/password.ts";

const [email, name, role] = process.argv.slice(2);
if (!email?.includes("@") || !name || !["ADMIN", "FISCAL", "OPERADOR"].includes(role)) {
  console.error('Uso: npm run user:create -- email "Nome" ADMIN|FISCAL|OPERADOR');
  process.exit(1);
}

function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    stdin.on("data", function onData(ch: string) {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    });
  });
}

try {
  process.loadEnvFile(".env.local");
} catch {}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não configurada (.env.local)");
  process.exit(1);
}

const password = await askHidden(`Senha (mín. ${MIN_PASSWORD} caracteres): `);
if ((await askHidden("Repita a senha: ")) !== password) {
  console.error("As senhas não conferem.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `INSERT INTO "User" (id, email, name, "passwordHash", role) VALUES ($1, $2, $3, $4, $5::"Role")`,
    [randomUUID(), email.toLowerCase(), name, await hashPassword(password), role],
  );
  console.log(`Usuário criado com papel ${role}.`);
} catch (e) {
  console.error((e as { code?: string }).code === "23505" ? "Já existe usuário com esse e-mail." : "Falha ao criar usuário.");
  process.exitCode = 1;
} finally {
  await client.end();
}
