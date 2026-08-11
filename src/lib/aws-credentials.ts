/**
 * AWS credential resolution, per service.
 *
 * S3 and SES each resolve their own credential, so they can be separate IAM users
 * with least-privilege policies — an attachment key that cannot send mail, and a
 * mail key that cannot read the bucket.
 *
 * Resolution order for a service, first match wins:
 *
 *   1. `<SERVICE>_ACCESS_KEY_ID` + `<SERVICE>_SECRET_ACCESS_KEY`
 *      (e.g. `S3_ACCESS_KEY_ID`, `SES_ACCESS_KEY_ID`) — the separate key.
 *   2. `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` — a shared key, for when one
 *      IAM user is fine for both.
 *   3. Nothing set -> `undefined`, so the SDK falls back to its default provider
 *      chain (shared profile, or an EC2/ECS instance role).
 *
 * A half-configured pair at any level is an error rather than a fall-through to
 * the next one. Silently dropping from a mistyped `SES_SECRET_ACCESS_KEY` to a
 * shared key — or worse, to an instance role in another account — is how mail
 * starts sending from an identity nobody intended.
 *
 * Pure and dependency-free so it is unit-testable. It must never log a secret.
 */

export type AwsService = "S3" | "SES";

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type EnvSource = Record<string, string | undefined>;

/** Where a service's credential came from — for diagnostics, never secrets. */
export type CredentialOrigin =
  | { kind: "service"; service: AwsService; keyIdTail: string; temporary: boolean }
  | { kind: "shared"; keyIdTail: string; temporary: boolean }
  | { kind: "default-chain" };

function read(source: EnvSource, name: string): string {
  return (source[name] ?? "").trim();
}

/**
 * Read one credential pair under a variable prefix.
 *
 * @returns the credentials, or null when NEITHER key is present.
 * @throws when exactly one of the pair is present.
 */
function readPair(
  source: EnvSource,
  prefix: string,
): AwsCredentials | null {
  const accessKeyId = read(source, `${prefix}_ACCESS_KEY_ID`);
  const secretAccessKey = read(source, `${prefix}_SECRET_ACCESS_KEY`);
  const sessionToken = read(source, `${prefix}_SESSION_TOKEN`);

  if (!accessKeyId && !secretAccessKey) return null;

  if (!accessKeyId || !secretAccessKey) {
    const missing = accessKeyId
      ? `${prefix}_SECRET_ACCESS_KEY`
      : `${prefix}_ACCESS_KEY_ID`;
    throw new Error(
      `${missing} is not set. Set both ${prefix}_ACCESS_KEY_ID and ${prefix}_SECRET_ACCESS_KEY, or neither.`,
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
}

/**
 * Credentials for one service, or `undefined` to let the SDK's default provider
 * chain resolve them.
 */
export function resolveAwsCredentials(
  service: AwsService,
  source: EnvSource = process.env,
): AwsCredentials | undefined {
  // Service-specific key first, so it always wins over a shared one.
  const specific = readPair(source, service);
  if (specific) return specific;

  const shared = readPair(source, "AWS");
  if (shared) return shared;

  return undefined;
}

/** Which credential a service will use. Safe to log — no secret, key id tail only. */
export function describeCredentialOrigin(
  service: AwsService,
  source: EnvSource = process.env,
): CredentialOrigin {
  const specific = readPair(source, service);
  if (specific) {
    return {
      kind: "service",
      service,
      keyIdTail: specific.accessKeyId.slice(-4),
      temporary: Boolean(specific.sessionToken),
    };
  }

  const shared = readPair(source, "AWS");
  if (shared) {
    return {
      kind: "shared",
      keyIdTail: shared.accessKeyId.slice(-4),
      temporary: Boolean(shared.sessionToken),
    };
  }

  return { kind: "default-chain" };
}

/** One-line rendering of the above, for startup logs and the admin screen. */
export function formatCredentialOrigin(origin: CredentialOrigin): string {
  switch (origin.kind) {
    case "service":
      return `${origin.service}-specific key …${origin.keyIdTail}${origin.temporary ? " (temporary)" : ""}`;
    case "shared":
      return `shared AWS key …${origin.keyIdTail}${origin.temporary ? " (temporary)" : ""}`;
    case "default-chain":
      return "default provider chain (IAM role or shared profile)";
  }
}
