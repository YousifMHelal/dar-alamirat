import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration. The connection URL lives here (used by the CLI
 * for introspection/migrations); the runtime client connects through the
 * Neon driver adapter in src/lib/prisma.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI-only connection (migrations, introspection, shadow-DB DDL). On Neon
    // these must use the DIRECT (non-pooled) host — PgBouncer, the `-pooler`
    // host in DATABASE_URL, can't serve DDL/shadow databases. Falls back to
    // DATABASE_URL when DIRECT_URL is unset (e.g. local Docker Postgres).
    // The runtime client reads DATABASE_URL itself (src/lib/prisma.ts) and is
    // unaffected by this.
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
