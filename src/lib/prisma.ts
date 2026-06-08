import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton.
 *
 * Uses the node-postgres (`pg`) driver adapter, which speaks standard
 * Postgres over TCP. The same client works against the local Docker
 * Postgres (development) and any hosted Postgres including Neon — so
 * moving environments is purely a DATABASE_URL change.
 *
 * In development we stash the instance on `globalThis` to survive HMR
 * and avoid exhausting the connection pool with a new client per reload.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
