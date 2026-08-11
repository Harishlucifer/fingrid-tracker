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

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npm run db:seed`. Prisma 7 reads the seed command from here, not from
    // the deprecated `prisma.seed` key in package.json.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrlFromEnv(),
  },
});
