/**
 * The browser's single HTTP entry point.
 *
 * Mirrors the role of `craft-apex/packages/api/src/client.ts`: one place unwraps
 * the envelope, one place turns an `{error}` body into a typed throw, and one
 * place handles an expired session. Features never call `fetch` directly, and
 * never set common headers themselves.
 *
 * Unlike craft-apex there is no Authorization header to attach — the session is
 * an httpOnly cookie the browser sends automatically, which is also why there is
 * no token-refresh interceptor here.
 */

import type { PageMeta } from "@/server/http/envelope";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Paged<T> = { data: T; meta: PageMeta };

type EnvelopeBody = {
  data?: unknown;
  meta?: PageMeta;
  error?: {
    code: string;
    message: string;
    request_id?: string;
    details?: unknown;
  };
};

/** Set by the app shell so a 401 can bounce to /login exactly once. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function request<T>(
  path: string,
  init: RequestInit & { rawBody?: boolean } = {},
): Promise<T> {
  const isFormData = init.body instanceof FormData;

  const response = await fetch(path, {
    ...init,
    headers: {
      // FormData must keep the browser-generated multipart boundary, so never
      // set Content-Type for it.
      ...(isFormData || !init.body
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    // Session cookie.
    credentials: "same-origin",
  });

  if (response.status === 204) return undefined as T;

  let body: EnvelopeBody;
  try {
    body = (await response.json()) as EnvelopeBody;
  } catch {
    throw new ApiError(
      response.status,
      "INTERNAL_001",
      `Unexpected non-JSON response (${response.status})`,
    );
  }

  if (!response.ok || body.error) {
    const error = body.error;

    if (response.status === 401) {
      onSessionExpired?.();
    }

    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL_001",
      error?.message ?? `Request failed (${response.status})`,
      error?.request_id,
      error?.details,
    );
  }

  return body.data as T;
}

/**
 * Paged variant — returns data AND meta. Kept separate so the common case stays
 * a bare payload rather than every caller destructuring `{data}`.
 */
async function requestPaged<T>(
  path: string,
  init: RequestInit = {},
): Promise<Paged<T>> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    credentials: "same-origin",
  });

  const body = (await response.json()) as EnvelopeBody;

  if (!response.ok || body.error) {
    if (response.status === 401) onSessionExpired?.();
    throw new ApiError(
      response.status,
      body.error?.code ?? "INTERNAL_001",
      body.error?.message ?? `Request failed (${response.status})`,
      body.error?.request_id,
      body.error?.details,
    );
  }

  return {
    data: body.data as T,
    meta: body.meta ?? { total: 0, page: 1, per_page: 0 },
  };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getPaged: <T>(path: string) => requestPaged<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Compose a query string, dropping empty values. */
export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
