/**
 * Prisma client singleton.
 *
 * Prisma 7 removed the Rust query engine, so the connection is supplied by a
 * driver adapter (`@prisma/adapter-mariadb`, which speaks the MySQL protocol)
 * rather than read from `schema.prisma`.
 *
 * The adapter is given a config OBJECT built from DB_HOST / DB_PORT / DB_USER /
 * DB_PASS / DB_NAME — not a URL. That means a password containing `@`, `:`, `/`
 * or `#` needs no escaping and cannot corrupt a connection string. Only the
 * Prisma CLI needs a URL, and `prisma.config.ts` composes one for it.
 *
 * The `globalThis` guard is required in dev: Next's hot reload re-evaluates this
 * module on every change, and without it each reload opens a new pool until
 * MySQL refuses connections.
 *
 * Node runtime only — Prisma cannot run on the Edge runtime. This is why
 * `src/middleware.ts` performs no database work.
 */

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";
import { databaseConfigFromEnv } from "@/lib/database-config";
import { env } from "@/lib/env";

function createPrismaClient() {
  const config = databaseConfigFromEnv();

  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  return new PrismaClient({
    adapter,
    log: env.isProd ? ["error"] : ["error", "warn"],
  });
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClientInstance;
};

export const prisma: PrismaClientInstance =
  globalForPrisma.__prisma ?? createPrismaClient();

if (!env.isProd) {
  globalForPrisma.__prisma = prisma;
}
