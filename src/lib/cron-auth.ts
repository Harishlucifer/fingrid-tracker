/**
 * Shared-secret authentication for scheduled-job endpoints.
 *
 * These are the only endpoints that cannot present a session: a scheduler calls
 * them from outside any browser, so there is no cookie and no user. Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET` when that variable is set on the
 * project, which is the credential checked here.
 *
 * Two decisions worth keeping:
 *
 *  * **Deny by default.** An unset or blank secret refuses every caller rather
 *    than opening the endpoint. Same posture as the sign-in callback: a missing
 *    configuration must lock the door, not remove it.
 *  * **The `x-vercel-cron` header is not accepted as proof.** It is not a
 *    secret and anyone who knows the URL can send it — the same reasoning that
 *    makes Google's `hd` parameter a UX hint rather than a security control.
 *
 * Pure and prisma-free so it can be unit-tested; see the note in AGENTS.md about
 * pure logic hiding behind a Prisma import.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/** Pull the token out of an `Authorization: Bearer <token>` header. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Constant-time comparison.
 *
 * Both sides are hashed first so the comparison always runs over two 32-byte
 * buffers: `timingSafeEqual` throws outright on a length mismatch, and the
 * length of the expected secret is itself something an attacker would like to
 * learn.
 */
export function secretsMatch(presented: string, expected: string): boolean {
  return timingSafeEqual(sha256(presented), sha256(expected));
}

/**
 * Whether a request carries the scheduled-job credential.
 *
 * `secret` is passed in rather than read from the environment here, so this
 * stays a pure function.
 */
export function isAuthorizedCronRequest(
  authorization: string | null | undefined,
  secret: string | undefined | null,
): boolean {
  if (!secret) return false;

  const presented = bearerToken(authorization);
  if (!presented) return false;

  return secretsMatch(presented, secret);
}
