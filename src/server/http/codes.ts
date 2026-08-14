/**
 * Stable machine-readable error codes.
 *
 * The convention comes from `fingrid-sdd/skills/05-api-contracts/SKILL.md`,
 * which defines a per-module code table (`AUTH_001` invalid/expired JWT,
 * `AUTH_003` missing role). Codes are part of the API contract: the client
 * branches on them, so they must never be renumbered or reused.
 */

export const ErrorCodes = {
  // Authentication / authorization
  AUTH_INVALID_SESSION: "AUTH_001",
  AUTH_DOMAIN_NOT_ALLOWED: "AUTH_002",
  AUTH_MISSING_ROLE: "AUTH_003",
  AUTH_ACCOUNT_DISABLED: "AUTH_004",
  AUTH_NO_PROJECT_ACCESS: "AUTH_005",
  /** Scheduled-job endpoints: missing or wrong shared secret. Never a session. */
  AUTH_INVALID_CRON_SECRET: "AUTH_006",

  // Request shape
  VALIDATION_FAILED: "VALIDATION_001",
  MALFORMED_JSON: "VALIDATION_002",

  // Resources
  NOT_FOUND: "RESOURCE_001",
  CONFLICT: "RESOURCE_002",

  // Board policy
  /** Destination column is at its WIP limit and the project enforces it. */
  WIP_LIMIT_REACHED: "BOARD_001",

  // Uploads
  UPLOAD_TOO_LARGE: "UPLOAD_001",
  UPLOAD_MIME_REJECTED: "UPLOAD_002",
  /** Uploadable, but never rendered inline — see PREVIEWABLE_MIME_TYPES. */
  UPLOAD_NOT_PREVIEWABLE: "UPLOAD_003",

  // Catch-alls
  RATE_LIMITED: "RATE_001",
  INTERNAL: "INTERNAL_001",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
