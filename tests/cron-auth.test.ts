/**
 * Tests for scheduled-job authentication.
 *
 * Like `domain.test.ts`, these encode decisions rather than behaviour: deny when
 * unconfigured, reject a header that merely claims to be a scheduler, and never
 * treat a prefix of the secret as a match.
 */

import { describe, expect, it } from "vitest";

import {
  bearerToken,
  isAuthorizedCronRequest,
  secretsMatch,
} from "@/lib/cron-auth";

const SECRET = "s3cr3t-value";

describe("bearerToken", () => {
  it("extracts the token", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
  });

  it("is case-insensitive on the scheme and tolerates padding", () => {
    expect(bearerToken("  bEaReR   abc123  ")).toBe("abc123");
  });

  it("returns null for a missing or non-bearer header", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc123")).toBeNull();
    expect(bearerToken("abc123")).toBeNull();
  });

  it("returns null when the scheme carries no token", () => {
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer   ")).toBeNull();
  });
});

describe("secretsMatch", () => {
  it("accepts an exact match", () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true);
  });

  it("rejects a mismatch without throwing on differing lengths", () => {
    expect(secretsMatch("short", SECRET)).toBe(false);
    expect(secretsMatch(`${SECRET}-and-more`, SECRET)).toBe(false);
  });

  it("rejects a prefix of the secret", () => {
    expect(secretsMatch(SECRET.slice(0, -1), SECRET)).toBe(false);
  });
});

describe("isAuthorizedCronRequest", () => {
  it("accepts the configured secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("denies when no secret is configured", () => {
    // The important one: an unset CRON_SECRET must lock the endpoint, not open
    // it. A caller presenting anything at all still gets nothing.
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer anything", "")).toBe(false);
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
  });

  it("denies a wrong or missing credential", () => {
    expect(isAuthorizedCronRequest("Bearer wrong", SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Basic ${SECRET}`, SECRET)).toBe(false);
  });

  it("ignores a header that only claims to come from a scheduler", () => {
    // `x-vercel-cron: 1` is not a credential; only the bearer token counts.
    expect(isAuthorizedCronRequest("1", SECRET)).toBe(false);
  });
});
