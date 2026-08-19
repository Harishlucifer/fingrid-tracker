"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The boundary for errors nothing else handled.
 *
 * Without this file Next renders its own built-in fallback, which says only
 * "This page couldn't load" — no message, no digest, nothing that distinguishes
 * a missing record from a database that is down. That is the same for every
 * failure on every screen, so a report of it carries no information and neither
 * the person hitting it nor anyone reading the logs learns anything.
 *
 * Expected failures should never reach here: a guard that refuses a page turns
 * into a redirect or a 404 through `server/auth/page-guards.ts`. Anything that
 * arrives is genuinely unexpected, so it shows the digest — the id Next also
 * writes to the server log next to the real stack, which is what makes a
 * production report traceable to a specific error.
 *
 * The prop is `retry`, not `reset`: Next 16 renamed it.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="text-muted-foreground font-mono text-sm">Error</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This page did not load. Trying again often works; if it does not, the
          reference below identifies this exact failure in the server log.
        </p>

        {error.digest && (
          <p className="text-muted-foreground bg-secondary mt-4 inline-block rounded-md px-2 py-1 font-mono text-xs">
            {error.digest}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={retry}
            className="text-accent hover:underline"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
