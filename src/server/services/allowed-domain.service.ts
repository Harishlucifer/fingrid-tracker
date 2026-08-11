/**
 * The domain allowlist — the feature this tool was built around.
 *
 * Admins manage rows here; `src/server/auth/config.ts` reads them on every
 * sign-in. Three rules are enforced in this file and must not be relaxed:
 *
 *   1. Domains are canonicalized before storage, so the stored value and the
 *      value derived from an email are directly comparable.
 *   2. Matching is exact — no implicit subdomain or suffix matching.
 *   3. Turning a domain off does NOT hard-delete it (the unique key would block
 *      re-adding it, and the history matters), and it revokes the live sessions
 *      of everyone who got in through it, so access is cut immediately rather
 *      than at the next sign-in.
 */

import { z } from "zod";

import { orgRoleSchema } from "@/lib/constants";
import { canonicalizeDomain } from "@/server/auth/domain";
import { prisma } from "@/server/db/prisma";
import { badRequest, conflict, notFound } from "@/server/http/errors";
import { buildMeta, type Pagination } from "@/server/http/pagination";

import { recordActivity } from "./activity.service";

/**
 * A domain string that must canonicalize. The transform is where sloppy input
 * ("HTTPS://Inforvio.com:443/") becomes "inforvio.com"; unusable input fails
 * validation rather than being stored in a form nothing will ever match.
 */
const domainField = z
  .string()
  .min(1, "Domain is required")
  .max(253)
  .transform((raw, ctx) => {
    const canonical = canonicalizeDomain(raw);
    if (!canonical) {
      ctx.addIssue({
        code: "custom",
        message:
          "Enter a bare domain such as inforvio.com (no scheme, port or path).",
      });
      return z.NEVER;
    }
    return canonical;
  });

export const createAllowedDomainSchema = z.object({
  domain: domainField,
  autoRole: orgRoleSchema.default("MEMBER"),
  note: z.string().max(500).optional(),
});

export const updateAllowedDomainSchema = z.object({
  autoRole: orgRoleSchema.optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
});

export type AllowedDomainDto = {
  id: string;
  domain: string;
  auto_role: string;
  is_active: boolean;
  note: string | null;
  user_count: number;
  created_at: string;
  updated_at: string;
};

type AllowedDomainRow = {
  id: string;
  domain: string;
  autoRole: string;
  isActive: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: AllowedDomainRow, userCount: number): AllowedDomainDto {
  return {
    id: row.id,
    domain: row.domain,
    auto_role: row.autoRole,
    is_active: row.isActive,
    note: row.note,
    user_count: userCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Count users whose email is on a given domain — shown in the admin table. */
async function countUsersOnDomains(
  domains: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (domains.length === 0) return counts;

  // One grouped query rather than N counts. Emails are stored lowercased, so a
  // suffix match on "@domain" is exact here.
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { email: true },
  });

  for (const domain of domains) counts.set(domain, 0);
  for (const { email } of users) {
    const at = email.lastIndexOf("@");
    if (at < 1) continue;
    const domain = email.slice(at + 1);
    if (counts.has(domain)) counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return counts;
}

export async function listAllowedDomains(pagination: Pagination) {
  const [rows, total] = await Promise.all([
    prisma.allowedDomain.findMany({
      orderBy: [{ isActive: "desc" }, { domain: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.allowedDomain.count(),
  ]);

  const counts = await countUsersOnDomains(rows.map((row) => row.domain));

  return {
    data: rows.map((row) => toDto(row, counts.get(row.domain) ?? 0)),
    meta: buildMeta(total, pagination),
  };
}

export async function createAllowedDomain(
  actorId: string,
  input: z.infer<typeof createAllowedDomainSchema>,
): Promise<AllowedDomainDto> {
  const existing = await prisma.allowedDomain.findUnique({
    where: { domain: input.domain },
  });

  // Re-adding a previously disabled domain reactivates the original row rather
  // than colliding on the unique key.
  if (existing) {
    if (existing.isActive) {
      throw conflict(`${input.domain} is already allowed.`);
    }

    const reactivated = await prisma.allowedDomain.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        autoRole: input.autoRole,
        note: input.note ?? existing.note,
      },
    });

    await recordActivity({
      entityType: "ALLOWED_DOMAIN",
      entityId: reactivated.id,
      actorId,
      action: "allowed_domain.reactivated",
      payload: { domain: reactivated.domain, autoRole: reactivated.autoRole },
    });

    return toDto(reactivated, 0);
  }

  const created = await prisma.allowedDomain.create({
    data: {
      domain: input.domain,
      autoRole: input.autoRole,
      note: input.note ?? null,
      createdById: actorId,
      isActive: true,
    },
  });

  await recordActivity({
    entityType: "ALLOWED_DOMAIN",
    entityId: created.id,
    actorId,
    action: "allowed_domain.created",
    payload: { domain: created.domain, autoRole: created.autoRole },
  });

  return toDto(created, 0);
}

export async function updateAllowedDomain(
  actorId: string,
  domainId: string,
  input: z.infer<typeof updateAllowedDomainSchema>,
): Promise<AllowedDomainDto> {
  const existing = await prisma.allowedDomain.findUnique({
    where: { id: domainId },
  });
  if (!existing) throw notFound("Domain not found");

  // Refuse to disable the last active domain: it would lock every user,
  // including this admin, out of the app with no way back in short of re-running
  // the seed script.
  if (input.isActive === false && existing.isActive) {
    const activeCount = await prisma.allowedDomain.count({
      where: { isActive: true },
    });
    if (activeCount <= 1) {
      throw badRequest(
        "This is the only active domain. Disabling it would lock everyone out, " +
          "including you. Add another domain first.",
      );
    }
  }

  const updated = await prisma.allowedDomain.update({
    where: { id: domainId },
    data: {
      ...(input.autoRole === undefined ? {} : { autoRole: input.autoRole }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.note === undefined ? {} : { note: input.note }),
    },
  });

  // Cut live sessions when a domain is turned off. Without this, users already
  // signed in would keep working until their session expired — the sign-in check
  // alone only stops the NEXT sign-in.
  let revokedSessions = 0;
  if (input.isActive === false && existing.isActive) {
    revokedSessions = await revokeSessionsForDomain(updated.domain);
  }

  await recordActivity({
    entityType: "ALLOWED_DOMAIN",
    entityId: updated.id,
    actorId,
    action:
      input.isActive === false && existing.isActive
        ? "allowed_domain.deactivated"
        : "allowed_domain.updated",
    payload: {
      domain: updated.domain,
      autoRole: updated.autoRole,
      isActive: updated.isActive,
      revokedSessions,
    },
  });

  const counts = await countUsersOnDomains([updated.domain]);
  return toDto(updated, counts.get(updated.domain) ?? 0);
}

/**
 * Delete every session belonging to users on a domain. Returns how many were
 * removed. Sessions are the revocation point — see the note on the database
 * session strategy in `src/server/auth/config.ts`.
 */
export async function revokeSessionsForDomain(
  canonicalDomain: string,
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${canonicalDomain}` } },
    select: { id: true, email: true },
  });

  // `endsWith` is a prefix-free match on the stored lowercase email, but verify
  // the domain exactly so "@evil-inforvio.com" cannot be caught by a sloppy
  // pattern — and, more importantly, so nothing outside the domain is affected.
  const userIds = users
    .filter((user) => {
      const at = user.email.lastIndexOf("@");
      return at > 0 && user.email.slice(at + 1) === canonicalDomain;
    })
    .map((user) => user.id);

  if (userIds.length === 0) return 0;

  const result = await prisma.session.deleteMany({
    where: { userId: { in: userIds } },
  });
  return result.count;
}
