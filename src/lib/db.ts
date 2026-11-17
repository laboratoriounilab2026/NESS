import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Uma instância por processo (o hot reload do dev recriaria conexões a cada edição).
const g = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  // DATABASE_POOL_MAX=1 no `prisma dev` local: o Postgres embutido aceita uma conexão por vez.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max }) });
}

export const db = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = db;
