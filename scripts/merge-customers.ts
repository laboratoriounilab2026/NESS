// Funde cadastros de cliente duplicados pelo mesmo CPF/CNPJ (com e sem pontuação) e normaliza o documento.
// Pré-requisito para o índice UNIQUE em Customer.document.
//   npm run customers:merge            → só mostra o que faria (nada muda)
//   npm run customers:merge -- --apply → executa numa transação única (IRREVERSÍVEL: faça backup antes)
// Mantém o cadastro mais antigo de cada grupo; pedidos dos demais passam para ele. Documentos aparecem mascarados.
import pg from "pg";

const apply = process.argv.includes("--apply");
try {
  process.loadEnvFile(".env.local");
} catch {}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não configurada (.env.local)");
  process.exit(1);
}

const mask = (d: string) => `${d.slice(0, 3)}•••••${d.slice(-2)}`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query<{ norm: string; ids: string[] }>(`
    SELECT upper(regexp_replace(document, '[^0-9A-Za-z]', '', 'g')) AS norm, array_agg(id ORDER BY "createdAt", id) AS ids
    FROM "Customer" GROUP BY 1 HAVING count(*) > 1`);
  const { rows: [{ n: unnormalized }] } = await client.query<{ n: string }>(`SELECT count(*) n FROM "Customer" WHERE document ~ '[^0-9A-Z]'`);

  console.log(`Grupos duplicados: ${rows.length}. Documentos com pontuação: ${unnormalized}.`);
  for (const g of rows) console.log(`  ${mask(g.norm)}: mantém 1, funde ${g.ids.length - 1}`);

  if (!apply) {
    await client.query("ROLLBACK");
    console.log("Nada foi alterado. Para executar: npm run customers:merge -- --apply");
  } else {
    for (const { ids } of rows) {
      const [keep, ...drop] = ids;
      await client.query(`UPDATE "EmissionOrder" SET "customerId" = $1 WHERE "customerId" = ANY($2)`, [keep, drop]);
      await client.query(`DELETE FROM "Customer" WHERE id = ANY($1)`, [drop]);
    }
    await client.query(`UPDATE "Customer" SET document = upper(regexp_replace(document, '[^0-9A-Za-z]', '', 'g')) WHERE document ~ '[^0-9A-Z]'`);
    await client.query(
      `INSERT INTO "AuditEvent" (id, actor, action, entity, "entityId", result, "correlationId", data) VALUES (gen_random_uuid(), 'script', 'cliente.fundir', 'Customer', '-', 'sucesso', gen_random_uuid(), $1)`,
      [JSON.stringify({ grupos: rows.length, normalizados: Number(unnormalized) })],
    );
    await client.query("COMMIT");
    console.log("Concluído.");
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Falha; nada foi alterado.", (e as { code?: string }).code ?? "");
  process.exitCode = 1;
} finally {
  await client.end();
}
