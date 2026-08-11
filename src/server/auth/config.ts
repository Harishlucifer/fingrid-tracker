/**
 * Auth.js (NextAuth v5) configuration — Google sign-in gated by a DB-backed
 * email-domain allowlist.
 *
 * ## Why database sessions
 *
 * `strategy: "database"`, not `"jwt"`. The requirement is that removing a domain
 * or deactivating a user cuts access; a stateless JWT cookie stays valid until it
 * expires, so it cannot satisfy that. A `session` row can be deleted, which is
 * the same reasoning behind `alpha-api`'s `core_user_token.revoked` column.
 * The `role` on the session is also read from the DB row on every request, so a
 * demotion takes effect immediately.
 *
 * The cost: Prisma cannot run on the Edge runtime, so `src/middleware.ts` cannot
 * verify a session. It performs a cookie-presence redirect only, and every real
 * authorization decision happens in Node — see `src/server/auth/guards.ts`.
 *
 * ## What enforces access
 *
 * The `signIn` callback below, and nothing else. In particular the Google `hd`
 * parameter is a UX hint that pre-filters the account chooser; it is
 * attacker-controllable and is NOT a security control.
 *
 * PKCE, `state` and nonce are handled by Auth.js itself — we add nothing there.
 * `allowDangerousEmailAccountLinking` is left at its default (off): with a single
 * provider there is no legitimate linking case, and enabling it is how an
 * account gets hijacked through an unverified email at a same-named provider.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "@/lib/env";
import { prisma } from "@/server/db/prisma";

import { domainFromEmail } from "./domain";

/**
 * The adapter's types are declared against `@prisma/client`'s `PrismaClient`,
 * while Prisma 7 generates ours to `src/generated/prisma`. The two are
 * structurally the same client; this cast is the single seam where that is
 * asserted, rather than loosening types across the app.
 */
const adapter = PrismaAdapter(
  prisma as unknown as Parameters<typeof PrismaAdapter>[0],
);

/** Reasons a sign-in was refused, surfaced to /login as ?error=<code>. */
export const SignInDenial = {
  DomainNotAllowed: "DomainNotAllowed",
  AccountDisabled: "AccountDisabled",
  VerificationFailed: "VerificationFailed",
} as const;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // refresh the row at most once a day
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  providers: [
    // clientId/clientSecret are omitted on purpose: Auth.js reads AUTH_GOOGLE_ID
    // and AUTH_GOOGLE_SECRET from the environment itself. Passing them here
    // would force an env read at module scope, which breaks `next build` (it
    // imports every route without secrets present).
    Google({
      authorization: {
        params: {
          prompt: "select_account",
          // UX hint only — see the note at the top of this file.
          ...(env.googleHostedDomain ? { hd: env.googleHostedDomain } : {}),
        },
      },
    }),
  ],
  callbacks: {
    /**
     * The gate. Deny by default, fail closed on any error.
     *
     * The email domain is re-derived server-side from the verified Google
     * profile and canonicalized before comparison — the idiom from
     * `alpha-api/app/services/connect/identity.go`, whose governing comment is
     * "Re-derive scenario from the domain — never trust the client
     * classification."
     */
    async signIn({ account, profile }) {
      // Google is the only credential channel we accept.
      if (account?.provider !== "google") return false;

      const email = typeof profile?.email === "string" ? profile.email.toLowerCase() : "";
      if (!email) return false;

      // Google must vouch for the address. An unverified Google email would let
      // anyone who can create an account at a lookalike domain in.
      if (profile?.email_verified !== true) {
        return `/login?error=${SignInDenial.VerificationFailed}`;
      }

      const domain = domainFromEmail(email);
      if (!domain) return `/login?error=${SignInDenial.DomainNotAllowed}`;

      try {
        const [allowed, existing] = await Promise.all([
          prisma.allowedDomain.findFirst({
            where: { domain, isActive: true },
            select: { id: true },
          }),
          prisma.user.findUnique({
            where: { email },
            select: { isActive: true, deletedAt: true },
          }),
        ]);

        // A deactivated or soft-deleted user is refused even if their domain is
        // still allowed.
        if (existing && (!existing.isActive || existing.deletedAt)) {
          return `/login?error=${SignInDenial.AccountDisabled}`;
        }

        // Checked on EVERY sign-in, not just the first: deactivating a domain
        // locks out everyone on it at their next sign-in.
        if (!allowed) {
          // The browser is told only "not approved" — never which domains are,
          // or the login page becomes a configuration oracle. The server log is
          // where an admin finds out what was actually refused, and why.
          console.warn(
            `[auth] refused sign-in: domain "${domain}" is not in allowed_domain ` +
              `(or is inactive).` +
              (env.isProd ? "" : ` email=${email}`),
          );
          return `/login?error=${SignInDenial.DomainNotAllowed}`;
        }

        return true;
      } catch (error) {
        // FAIL CLOSED. If we cannot confirm the domain is allowed, it is not.
        console.error("[auth] allowlist lookup failed", { domain, error });
        return false;
      }
    },

    /**
     * With the database strategy, `user` is the freshly-read DB row — so role
     * and isActive on the session are never stale.
     */
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: string }).role ?? "VIEWER";
        session.user.isActive =
          (user as { isActive?: boolean }).isActive ?? false;
      }
      return session;
    },
  },
  events: {
    /**
     * Role assignment for brand-new users, and the bootstrap admin promotion.
     *
     * The adapter has already inserted the row with the schema default
     * (`MEMBER`) by the time this runs, so this is an update. It is the only
     * place BOOTSTRAP_ADMIN_EMAILS is honored — after the first admin exists,
     * roles are managed in the Settings UI and the env var is inert.
     */
    async createUser({ user }) {
      if (!user.email || !user.id) return;

      const email = user.email.toLowerCase();
      const domain = domainFromEmail(email);

      const isBootstrapAdmin = env.bootstrapAdminEmails.includes(email);

      let role = "MEMBER";
      if (isBootstrapAdmin) {
        role = "ADMIN";
      } else if (domain) {
        const allowedDomain = await prisma.allowedDomain.findFirst({
          where: { domain, isActive: true },
          select: { autoRole: true },
        });
        if (allowedDomain) role = allowedDomain.autoRole;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { email, role },
      });

      await prisma.activityLog.create({
        data: {
          entityType: "USER",
          entityId: user.id,
          actorId: user.id,
          action: "user.created",
          payload: { email, role, viaDomain: domain },
        },
      });
    },

    async signIn({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    },
  },
});
