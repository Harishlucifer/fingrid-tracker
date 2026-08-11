/**
 * Bootstrap seed. `npm run db:seed`.
 *
 * Its only job is to make the FIRST sign-in possible. The sign-in callback reads
 * the `allowed_domain` table and nothing else — there is deliberately no runtime
 * fallback to BOOTSTRAP_ALLOWED_DOMAINS, because a config fallback in the
 * sign-in path is an allowlist bypass. So an unseeded database locks everyone
 * out, by design, and this script is a required setup step rather than an
 * optional convenience.
 *
 * Idempotent: re-running it re-activates and updates existing rows rather than
 * failing on the unique key.
 */

import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import { canonicalizeDomain } from "../src/server/auth/domain";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — cannot seed.`);
  return value;
}

function parseList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const adapter = new PrismaMariaDb(requireEnv("DATABASE_URL"));
  const prisma = new PrismaClient({ adapter });

  try {
    const rawDomains = parseList("BOOTSTRAP_ALLOWED_DOMAINS");
    const adminEmails = parseList("BOOTSTRAP_ADMIN_EMAILS").map((e) =>
      e.toLowerCase(),
    );

    if (rawDomains.length === 0) {
      console.warn(
        "[seed] BOOTSTRAP_ALLOWED_DOMAINS is empty. No domains seeded, which " +
          "means NOBODY will be able to sign in. Set it in .env and re-run.",
      );
    }

    // Canonicalize before storing so both sides of every future comparison are
    // already normalized (the CleanDomain rule from alpha-api).
    const canonical: string[] = [];
    for (const raw of rawDomains) {
      const domain = canonicalizeDomain(raw);
      if (!domain) {
        console.warn(`[seed] skipping unusable domain: ${JSON.stringify(raw)}`);
        continue;
      }
      canonical.push(domain);
    }

    for (const domain of canonical) {
      const result = await prisma.allowedDomain.upsert({
        where: { domain },
        // Re-activate if it was previously turned off, but never silently
        // downgrade an admin's chosen autoRole on re-seed.
        update: { isActive: true },
        create: {
          domain,
          autoRole: "MEMBER",
          isActive: true,
          note: "Seeded from BOOTSTRAP_ALLOWED_DOMAINS",
        },
      });
      console.log(`[seed] allowed domain: ${result.domain} (${result.autoRole})`);
    }

    // Promote any admin who already exists. Users who have not signed in yet are
    // promoted by the `createUser` event in src/server/auth/config.ts instead.
    for (const email of adminEmails) {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });

      if (!existing) {
        console.log(
          `[seed] ${email} will be promoted to ADMIN on first sign-in.`,
        );
        continue;
      }

      if (existing.role === "ADMIN") {
        console.log(`[seed] ${email} is already ADMIN.`);
        continue;
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", isActive: true },
      });
      console.log(`[seed] promoted ${email} to ADMIN.`);
    }

    const activeDomains = await prisma.allowedDomain.count({
      where: { isActive: true },
    });
    console.log(
      `[seed] done. ${activeDomains} active domain(s) may sign in.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed] failed", error);
  process.exit(1);
});
