/**
 * The single place route handlers are wrapped.
 *
 * Equivalent of `fingrid-fas/src/middleware/errors.go`: one mapper turns thrown
 * `AppError`s into the envelope, logs 5xx with the request id, and replaces any
 * unrecognized error with a generic 500 so internals never reach the client.
 *
 * Shape:
 *
 *   export const GET = withApiHandler(
 *     () => requireProjectAccess(id, "VIEW"),
 *     async (ctx, req) => listTasks(ctx, req),
 *   );
 *
 * The guard is the first argument rather than something the body may forget to
 * call, so an unauthenticated handler is not expressible.
 */

import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ErrorCodes } from "./codes";
import { AppError } from "./errors";
import { jsonError, jsonOk, type ApiFailure, type ApiSuccess, type PageMeta } from "./envelope";

/** Result a handler body may return: bare payload, or payload + pagination. */
export type HandlerResult<T> = T | { data: T; meta: PageMeta };

function hasMeta<T>(value: HandlerResult<T>): value is { data: T; meta: PageMeta } {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "meta" in value
  );
}

/** Echo an inbound X-Request-Id when present so logs correlate across hops. */
function resolveRequestId(req: NextRequest): string {
  return req.headers.get("x-request-id") ?? randomUUID();
}

export function withApiHandler<TCtx, TBody, TArgs = unknown>(
  guard: (req: NextRequest, args: TArgs) => Promise<TCtx>,
  body: (
    ctx: TCtx,
    req: NextRequest,
    args: TArgs,
  ) => Promise<HandlerResult<TBody>>,
  options?: { successStatus?: number },
) {
  return async (
    req: NextRequest,
    args: TArgs,
  ): Promise<NextResponse<ApiSuccess<TBody> | ApiFailure>> => {
    const requestId = resolveRequestId(req);

    try {
      const ctx = await guard(req, args);
      const result = await body(ctx, req, args);

      if (hasMeta<TBody>(result)) {
        return jsonOk(result.data, {
          requestId,
          meta: result.meta,
          status: options?.successStatus,
        });
      }

      return jsonOk(result as TBody, {
        requestId,
        status: options?.successStatus,
      });
    } catch (error) {
      if (error instanceof AppError) {
        if (error.status >= 500) {
          console.error("[api] internal error", {
            requestId,
            code: error.code,
            message: error.message,
          });
          return jsonError({
            status: error.status,
            code: error.code,
            message: "Internal server error",
            requestId,
          });
        }

        return jsonError({
          status: error.status,
          code: error.code,
          message: error.message,
          requestId,
          details: error.details,
        });
      }

      if (error instanceof ZodError) {
        return jsonError({
          status: 400,
          code: ErrorCodes.VALIDATION_FAILED,
          message: "Request validation failed",
          requestId,
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      // Anything unrecognized is a bug: log it in full, tell the client nothing.
      console.error("[api] unhandled error", { requestId, error });
      return jsonError({
        status: 500,
        code: ErrorCodes.INTERNAL,
        message: "Internal server error",
        requestId,
      });
    }
  };
}

/** Parse and validate a JSON body, mapping malformed JSON to a 400. */
export async function readJson<T>(
  req: NextRequest,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(
      400,
      ErrorCodes.MALFORMED_JSON,
      "Request body is not valid JSON",
    );
  }
  return schema.parse(raw);
}
