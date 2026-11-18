import { connection } from "next/server";
import { db } from "@/lib/db";

// Saúde para hospedagem/monitor de disponibilidade. Público (fora do proxy de login): só diz ok/falha, sem detalhes.
export async function GET() {
  await connection(); // sempre dinâmico: nunca servir um "ok" em cache
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "erro" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
