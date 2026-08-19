"use client";

import { useEffect, useState } from "react";

/**
 * A value that settles after the caller stops changing it.
 *
 * For search boxes whose value is part of a TanStack Query key: without this,
 * every keystroke is a distinct key and therefore a distinct request, so typing
 * "invoice" fires seven queries and the first six are already stale when they
 * land. That was tolerable while a list simply re-rendered; it is worse
 * alongside a pager, where each in-flight page also competes to be the one
 * `keepPreviousData` shows.
 *
 * Deliberately debounced rather than throttled: nobody wants results for a
 * half-typed word, they want them once the word is finished.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    // Every change cancels the pending update, which is what makes this a
    // debounce — the timer only fires once typing pauses for `delayMs`.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
