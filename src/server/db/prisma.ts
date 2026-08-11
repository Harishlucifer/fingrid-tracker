/**
 * Prisma client singleton.
 *
 * Prisma 7 removed the Rust query engine, so the connection string is no longer
 * read from `schema.prisma` — it arrives through a driver adapter
 * (`@prisma/adapter-mariadb`, which speaks the MySQL protocol). The CLI reads
 * the same URL separately from `prisma.config.ts`.
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
import { env } from "@/lib/env";

function createPrismaClient() {
  const adapter = new PrismaMariaDb(env.databaseUrl);

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
