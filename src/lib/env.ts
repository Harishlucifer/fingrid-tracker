/**
 * Typed environment access.
 *
 * Follows the house pattern from `craft-apex/apps/employee-portal/src/env.ts`
 * and `fingrid-fas/src/config/config.go`: one module owns process.env, nothing
 * else reads it directly, and a missing required value produces a clear error
 * rather than an undefined at the first request.
 *
 * Required values are exposed as **lazy getters**, deliberately. A module-scope
 * throw would break `next build`, which imports every route to collect page
 * data and does so without production secrets present. Reading the value is what
 * fails, at the moment it is actually needed.
 *
 * Auth.js reads `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from the
 * environment itself, so they are intentionally absent here — duplicating the
 * lookup would just add a second place to get it wrong.
 *
 * Server-only. Never import from a client component.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

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

  /** Required — throws on read if unset. */
  get databaseUrl() {
    return required("DATABASE_URL");
  },

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

  get storageDriver() {
    return (optional("STORAGE_DRIVER") ?? "local") as "local" | "s3";
  },
  get storageLocalDir() {
    return optional("STORAGE_LOCAL_DIR") ?? "./var/uploads";
  },
  get maxUploadBytes() {
    return int("MAX_UPLOAD_BYTES", 25 * 1024 * 1024);
  },

  /** Required when STORAGE_DRIVER=s3. Must be a PRIVATE bucket. */
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
