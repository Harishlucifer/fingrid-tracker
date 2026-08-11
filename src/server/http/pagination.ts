/**
 * Pagination, in the shape the org's API contract mandates:
 * `?page=1&per_page=20` in, `{data: [], meta: {total, page, per_page}}` out.
 */

import { DEFAULT_PER_PAGE, MAX_PER_PAGE } from "@/lib/constants";

import type { PageMeta } from "./envelope";

export type Pagination = {
  page: number;
  perPage: number;
  skip: number;
  take: number;
};

/**
 * Parse pagination params, clamping rather than rejecting. A caller asking for
 * `per_page=100000` gets MAX_PER_PAGE, not a 400 — the cap exists to protect the
 * database, and a hard error here would be hostile for no benefit.
 */
export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const rawPerPage = Number.parseInt(searchParams.get("per_page") ?? "", 10);

  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const perPage =
    Number.isNaN(rawPerPage) || rawPerPage < 1
      ? DEFAULT_PER_PAGE
      : Math.min(rawPerPage, MAX_PER_PAGE);

  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function buildMeta(
  total: number,
  { page, perPage }: Pagination,
): PageMeta {
  return { total, page, per_page: perPage };
}
