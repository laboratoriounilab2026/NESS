// Gestão de contas pelo terminal. Uso:
//   npm run user:create   -- email@empresa.com "Nome Completo" ADMIN|FISCAL|OPERADOR
//   npm run user:password -- email@empresa.com      (troca a senha e encerra as sessões abertas)
//   npm run user:disable  -- email@empresa.com      (bloqueia o acesso e encerra as sessões abertas)
//   npm run user:enable   -- email@empresa.com
// A senha é digitada no terminal (sem eco) e nunca aparece em argumentos, histórico ou log.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword, MIN_PASSWORD } from "../src/auth/password.ts";

const [cmd, email, name, role] = process.argv.slice(2);
const usage = () => {
  console.error('Uso: create email "Nome" ADMIN|FISCAL|OPERADOR | password email | disable email | enable email');
  process.exit(1);
};
if (!email?.includes("@")) usage();
if (cmd === "create" && (!name || !["ADMIN", "FISCAL", "OPERADOR"].includes(role))) usage();
if (!["create", "password", "disable", "enable"].includes(cmd)) usage();

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

async function newPasswordHash() {
  const password = await askHidden(`Senha (mín. ${MIN_PASSWORD} caracteres): `);
  if ((await askHidden("Repita a senha: ")) !== password) {
    console.error("As senhas não conferem.");
    process.exit(1);
  }
  return hashPassword(password);
}

try {
  process.loadEnvFile(".env.local");
} catch {}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não configurada (.env.local)");
  process.exit(1);
}

const hash = cmd === "create" || cmd === "password" ? await newPasswordHash() : null;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const addr = email.toLowerCase();
try {
  if (cmd === "create") {
    await client.query(`INSERT INTO "User" (id, email, name, "passwordHash", role) VALUES ($1, $2, $3, $4, $5::"Role")`, [randomUUID(), addr, name, hash, role]);
    console.log(`Usuário criado com papel ${role}.`);
  } else {
    await client.query("BEGIN");
    const set = cmd === "password" ? `"passwordHash" = $2` : `active = ${cmd === "enable"}`;
    const r = await client.query(`UPDATE "User" SET ${set} WHERE email = $1 RETURNING id`, cmd === "password" ? [addr, hash] : [addr]);
    if (r.rowCount !== 1) throw Object.assign(new Error(), { code: "not_found" });
    if (cmd !== "enable") await client.query(`DELETE FROM "Session" WHERE "userId" = $1`, [r.rows[0].id]);
    await client.query("COMMIT");
    console.log({ password: "Senha trocada; sessões abertas encerradas.", disable: "Acesso bloqueado; sessões abertas encerradas.", enable: "Acesso reativado." }[cmd]);
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  const code = (e as { code?: string }).code;
  console.error(code === "23505" ? "Já existe usuário com esse e-mail." : code === "not_found" ? "Usuário não encontrado." : "Falha na operação.");
  process.exitCode = 1;
} finally {
  await client.end();
}
