// Dados mínimos do E2E (só banco descartável do CI): um estabelecimento SEM regra fiscal e um operador.
// Senha vem de E2E_PASSWORD, gerada aleatoriamente a cada execução do CI; nunca fica no repositório.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "../src/auth/password.ts";

const { DATABASE_URL, E2E_PASSWORD } = process.env;
if (!DATABASE_URL || !E2E_PASSWORD) {
  console.error("DATABASE_URL e E2E_PASSWORD são obrigatórias");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  // Identificadores claramente fictícios (CNPJ zerado, IBGE zerado): não são parâmetros fiscais.
  await client.query(
    `INSERT INTO "Establishment" (id, cnpj, name, uf, "municipioIbge", regime) VALUES ($1, '00000000000000', 'Estúdio E2E', 'SP', '0000000', 'e2e')`,
    [randomUUID()],
  );
  await client.query(`INSERT INTO "User" (id, email, name, "passwordHash", role) VALUES ($1, 'operador@e2e.test', 'Operador E2E', $2, 'OPERADOR'::"Role")`, [
    randomUUID(),
    await hashPassword(E2E_PASSWORD),
  ]);
  console.log("Seed E2E aplicado.");
} finally {
  await client.end();
}
