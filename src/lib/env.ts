/**
 * Typed environment access.
 *
 * Follows the house pattern from `craft-apex/apps/employee-portal/src/env.ts`
 * and `fingrid-fas/src/config/config.go`: one module owns process.env and
 * nothing else reads it directly.
 *
 * Every value here is optional-with-a-default, and everything read as a **lazy
 * getter** — deliberately. A module-scope throw would break `next build`, which
 * imports every route to collect page data without production secrets present.
 * Where a value genuinely has no safe default, the consumer raises a named error
 * at the point of use instead: `S3_BUCKET` in `src/server/storage/s3.ts`,
 * `DB_NAME` in `src/lib/database-config.ts`.
 *
 * Auth.js reads `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from the
 * environment itself, so they are intentionally absent here — duplicating the
 * lookup would just add a second place to get it wrong.
 *
 * Server-only. Never import from a client component.
 */

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer, got "${raw}".`);
  }
  return parsed;
}

/** Comma-separated list -> trimmed, non-empty items. */
function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },

  /**
   * The database connection is deliberately NOT here. It is assembled from
   * DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME by `@/lib/database-config`,
   * which both the app and `prisma.config.ts` import — the CLI can read it that
   * way without loading this module (and its Google/SES getters).
   */

  /**
   * Optional Google `hd` hint. Pre-filters the account chooser to one Workspace
   * domain. UX convenience ONLY — `hd` is attacker-controllable, so the
   * allowlist check in the signIn callback remains the sole enforcement.
   */
  get googleHostedDomain() {
    return optional("GOOGLE_HD");
  },

  /** Emails promoted to ADMIN on first sign-in. Inert once an admin exists. */
  get bootstrapAdminEmails() {
    return list("BOOTSTRAP_ADMIN_EMAILS").map((email) => email.toLowerCase());
  },

  get maxUploadBytes() {
    return int("MAX_UPLOAD_BYTES", 25 * 1024 * 1024);
  },

  /**
   * Required — S3 is the only attachment store. Must be a PRIVATE bucket.
   * Still read through `optional()` so `next build`, which imports every route
   * without secrets present, does not throw; the S3 driver raises a named error
   * when it is actually missing.
   */
  get s3Bucket() {
    return optional("S3_BUCKET");
  },
  get s3Region() {
    return optional("S3_REGION") ?? optional("AWS_REGION") ?? "ap-south-1";
  },
  /** Optional key prefix, so one bucket can host several environments. */
  get s3Prefix() {
    return optional("S3_PREFIX");
  },
  /**
   * Only for S3-compatible endpoints (MinIO, LocalStack). Leave unset for real
   * S3 so the SDK resolves the regional endpoint itself.
   */
  get s3Endpoint() {
    return optional("S3_ENDPOINT");
  },
  /** Set to use SSE-KMS instead of the SSE-S3 default. */
  get s3KmsKeyId() {
    return optional("S3_KMS_KEY_ID");
  },

  // --- email / notifications ---

  /** `log` prints to the console (default, no AWS needed); `ses` sends for real. */
  get mailDriver() {
    return (optional("MAIL_DRIVER") ?? "log") as "log" | "ses";
  },
  /** Must be an identity verified in SES when MAIL_DRIVER=ses. */
  get mailFrom() {
    return optional("MAIL_FROM");
  },
  get sesRegion() {
    return optional("SES_REGION") ?? optional("AWS_REGION") ?? "ap-south-1";
  },
  /** Routes bounces and complaints to SNS. Strongly recommended in production. */
  get sesConfigurationSet() {
    return optional("SES_CONFIGURATION_SET");
  },
  /**
   * Absolute base URL used to build links in emails. Emails are read outside the
   * app, so a relative path is useless — this must be set for links to work.
   */
  get appUrl() {
    return (
      optional("APP_URL") ?? optional("AUTH_URL") ?? "http://localhost:3000"
    );
  },
} as const;

export type Env = typeof env;
