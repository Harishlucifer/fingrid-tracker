/**
 * Typed application errors.
 *
 * A direct port of `fingrid-fas/src/utils/error.go`: services throw an
 * `AppError` carrying the HTTP status, a stable code and a client-safe message.
 * One central handler (`withApiHandler`) maps them to the response envelope,
 * logs 5xx, and never leaks an internal message to the client.
 */

import { ErrorCodes, type ErrorCode } from "./codes";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;
  /** Optional structured detail — e.g. zod field issues. Safe to expose. */
  readonly details?: unknown;

  constructor(
    status: number,
    code: ErrorCode | string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (
  message: string,
  code: ErrorCode | string = ErrorCodes.VALIDATION_FAILED,
  details?: unknown,
) => new AppError(400, code, message, details);

export const unauthorized = (message = "Authentication required") =>
  new AppError(401, ErrorCodes.AUTH_INVALID_SESSION, message);

export const forbidden = (
  message = "You do not have permission to do that",
  code: ErrorCode | string = ErrorCodes.AUTH_MISSING_ROLE,
) => new AppError(403, code, message);

export const notFound = (message = "Not found") =>
  new AppError(404, ErrorCodes.NOT_FOUND, message);

export const conflict = (message: string) =>
  new AppError(409, ErrorCodes.CONFLICT, message);

export const payloadTooLarge = (message: string) =>
  new AppError(413, ErrorCodes.UPLOAD_TOO_LARGE, message);

export const unsupportedMediaType = (message: string) =>
  new AppError(415, ErrorCodes.UPLOAD_MIME_REJECTED, message);

export const tooManyRequests = (message = "Too many requests") =>
  new AppError(429, ErrorCodes.RATE_LIMITED, message);

/** Internal failures keep their real message for logs only. */
export const internal = (message = "Internal server error") =>
  new AppError(500, ErrorCodes.INTERNAL, message);
