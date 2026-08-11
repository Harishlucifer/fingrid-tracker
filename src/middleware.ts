/**
 * A UX redirect, NOT a security boundary.
 *
 * Middleware runs on the Edge runtime, where Prisma cannot run, so it cannot
 * verify a database-backed session. All it does is check whether a session
 * cookie is present and bounce anonymous visitors to /login before they load an
 * app shell they cannot use.
 *
 * Every real authorization decision happens in Node: `(app)/layout.tsx` calls
 * `requireSession()`, and every route handler goes through a guard in
 * `src/server/auth/guards.ts`. A forged cookie gets past this file and is then
 * rejected there — which is the intended division of labour, and the documented
 * Auth.js v5 pattern for database sessions.
 */

import { NextResponse, type NextRequest } from "next/server";

/** Auth.js names the cookie `authjs.session-token`, `__Secure-` prefixed on https. */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) =>
    req.cookies.has(name),
  );

  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  // Preserve intent so login can return the user where they were headed.
  const intended = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (intended && intended !== "/") {
    loginUrl.searchParams.set("next", intended);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Guard the app shell only. Excluded: /login, everything under /api (route
   * handlers run their own guards and must return JSON 401s rather than a
   * redirect), Next's internals, and static files.
   */
  matcher: [
    "/((?!login|api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
