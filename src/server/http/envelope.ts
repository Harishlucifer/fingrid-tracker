/**
 * The response envelope.
 *
 * Ported from `fingrid-fas/src/response/response.go`:
 *
 *   success -> { "data": <payload> }
 *   failure -> { "error": { "code", "message", "request_id" } }
 *
 * Never both. `alpha-api`'s older `{status: 1, data}` / `{status: -2, error}`
 * shape with meaningful negative status codes is deliberately NOT used — the
 * newer services standardized on this one.
 */

import { NextResponse } from "next/server";

export type PageMeta = {
  total: number;
  page: number;
  per_page: number;
};

export type ApiSuccess<T> = { data: T; meta?: PageMeta };
export type ApiFailure = {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: unknown;
  };
};

export function jsonOk<T>(
  data: T,
  init?: { status?: number; requestId?: string; meta?: PageMeta },
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = init?.meta ? { data, meta: init.meta } : { data };

  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: init?.requestId ? { "X-Request-Id": init.requestId } : undefined,
  });
}

export function jsonError(args: {
  status: number;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}): NextResponse<ApiFailure> {
  const body: ApiFailure = {
    error: {
      code: args.code,
      message: args.message,
      request_id: args.requestId,
      ...(args.details === undefined ? {} : { details: args.details }),
    },
  };

  return NextResponse.json(body, {
    status: args.status,
    headers: { "X-Request-Id": args.requestId },
  });
}
