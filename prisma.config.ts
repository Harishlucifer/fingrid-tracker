// Prisma 7 configuration.
//
// The CLI (migrate, studio, db seed) only understands a connection URL, so one is
// composed here from the discrete DB_* variables. The RUNTIME client does not use
// a URL at all — it passes a config object to the driver adapter, which is why a
// password with `@` or `:` in it needs no escaping there. See
// `src/lib/database-config.ts`.
//
// Relative import, not the `@/` alias: this file is loaded by the Prisma CLI,
// which does not resolve the app's tsconfig paths.
import "dotenv/config";
import { defineConfig } from "prisma/config";

import { databaseUrlFromEnv } from "./src/lib/database-config";

/**
 * The datasource is optional in Prisma 7 — only migrate/studio/seed need it, and
 * `prisma generate` does not. A build machine (Vercel) runs `prisma generate`
 * with no database in sight, so a missing DB_* variable must not be fatal there:
 * it is reported and the datasource is omitted, which still fails loudly — with
 * this warning right above it — if a migration command is what was being run.
 */
function cliDatasource() {
  try {
    return { url: databaseUrlFromEnv() };
  } catch (error) {
    console.warn(
      `prisma.config.ts: no datasource URL — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return undefined;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npm run db:seed`. Prisma 7 reads the seed command from here, not from
    // the deprecated `prisma.seed` key in package.json.
    seed: "tsx prisma/seed.ts",
  },
  datasource: cliDatasource(),
});
