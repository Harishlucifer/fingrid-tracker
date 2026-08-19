/**
 * Guards for **Server Components**, as opposed to route handlers.
 *
 * The guards in `guards.ts` throw an `AppError` carrying an HTTP status, and one
 * central handler — `withApiHandler` — turns that into the response envelope.
 * A page has no such handler. An `AppError` thrown while rendering one is, to
 * Next, simply an uncaught exception: it unwinds to the nearest error boundary
 * and renders "this page couldn't load", with no status, no message, and nothing
 * in the UI to distinguish "that project does not exist" from "the database is
 * down". Every page under `(app)/` did exactly that, so a member opening a
 * project they had not been added to saw a crash rather than a 404.
 *
 * These wrappers translate instead of rethrowing, into the two outcomes Next
 * actually understands:
 *
 *   * **401 → `redirect("/login")`.** The session went away mid-visit; send them
 *     to sign in again rather than showing them a broken page.
 *   * **anything else → `notFound()`.** Including 403. That is not laziness: it
 *     is the same reasoning `requireProjectAccess` already applies when it
 *     reports an inaccessible project as 404 — a distinct "forbidden" page would
 *     confirm the project exists to somebody with no access to it. (Next's own
 *     `forbidden()` is still experimental, so it is not an option here anyway.)
 *
 * The authorization itself is unchanged — these call the same guards. Only the
 * failure is presented differently, which is the part a page needs and a route
 * handler does not.
 */

import { notFound as renderNotFound, redirect } from "next/navigation";

import type { AccessLevel } from "@/lib/permissions";
import { AppError } from "@/server/http/errors";

import {
  requireAdmin,
  requireProjectAccess,
  requireSession,
  requireTaskAccess,
  type AuthCtx,
  type ProjectAuthCtx,
} from "./guards";

/**
 * Run a guard, mapping its `AppError` onto a Next navigation.
 *
 * Only `AppError` is translated. Anything else — a dropped database connection,
 * a bug — is rethrown untouched, because those genuinely are unexpected and
 * should reach the error boundary rather than be disguised as a missing page.
 */
async function asPage<T>(guard: () => Promise<T>): Promise<T> {
  try {
    return await guard();
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.status === 401) redirect("/login");
    renderNotFound();
  }
}

export function requireSessionPage(): Promise<AuthCtx> {
  return asPage(() => requireSession());
}

export function requireAdminPage(): Promise<AuthCtx> {
  return asPage(() => requireAdmin());
}

export function requireProjectPage(
  projectId: string,
  required: AccessLevel = "VIEW",
): Promise<ProjectAuthCtx> {
  return asPage(() => requireProjectAccess(projectId, required));
}

export function requireTaskPage(
  taskId: string,
  required: AccessLevel = "VIEW",
): Promise<ProjectAuthCtx & { taskId: string }> {
  return asPage(() => requireTaskAccess(taskId, required));
}
