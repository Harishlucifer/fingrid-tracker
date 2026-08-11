// Prisma 7 configuration.
//
// The connection string lives here (and in `.env`, which this loads) rather than
// in `schema.prisma` — Prisma 7 removed the datasource `url` property. The
// runtime client gets the same URL through a driver adapter; see
// `src/server/db/prisma.ts`.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npm run db:seed`. Prisma 7 reads the seed command from here, not from
    // the deprecated `prisma.seed` key in package.json.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
