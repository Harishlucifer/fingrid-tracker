"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/server/http/envelope";

/**
 * Page controls for a `{data, meta}` list.
 *
 * The first pagination UI in this codebase, and it exists because the API has
 * always been paginated while no screen ever offered a way to reach page two:
 * every list asks for `per_page=100` and renders whatever comes back, so the
 * hundred-and-first row was simply unreachable. `MAX_PER_PAGE` is 100, so asking
 * for more does not help — `parsePagination` clamps rather than errors, which
 * means the truncation is silent.
 *
 * Renders nothing on a single page. A pager under a list that fits is furniture,
 * and it would appear under every list that adopts this.
 *
 * The other lists — members, domains, backlog, comments — are candidates for
 * this and each currently has the same latent ceiling.
 */
export function Pager({
  meta,
  onPageChange,
  disabled = false,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  /** True while a fetch is in flight, so a page cannot be skipped past. */
  disabled?: boolean;
}) {
  const lastPage = Math.max(1, Math.ceil(meta.total / Math.max(meta.per_page, 1)));
  if (lastPage <= 1) return null;

  const first = (meta.page - 1) * meta.per_page + 1;
  const last = Math.min(meta.page * meta.per_page, meta.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-muted-foreground text-xs">
        {/* The range, not just the page number: "showing 51–100 of 240" is what
            tells someone whether it is worth paging on. */}
        <span className="tnum">
          {first}–{last}
        </span>{" "}
        of <span className="tnum">{meta.total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="text-muted-foreground tnum text-xs">
          Page {meta.page} of {lastPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={disabled || meta.page >= lastPage}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
