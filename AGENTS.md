# Inforvio PM — working notes

Internal project-management tool. Google sign-in only, restricted to email
domains an admin configures in the app.

## Commands

```bash
npm run dev            # :3000
npm run typecheck      # tsc --noEmit — the primary gate
npm run lint           # eslint (flat config)
npm run test           # vitest — pure logic only, no DB needed
npm run build          # production build

npm run db:migrate     # prisma migrate dev
npm run db:seed        # REQUIRED before first login — seeds allowed_domain
npm run db:studio      # inspect rows
```

MySQL must be running (`brew services start mysql`). `curl localhost:3000/api/readyz`
returns 503 when it is not — that is the fastest diagnosis when sign-in fails,
because the sign-in callback **fails closed** if it cannot reach the database.

## The thing to understand first

**Access is gated by the `allowed_domain` table, checked on every sign-in.**

- `src/server/auth/domain.ts` — canonicalization and exact matching. Pure, and
  covered by `tests/domain.test.ts`. Both sides of every comparison run through
  `canonicalizeDomain`.
- `src/server/auth/config.ts` — the `signIn` callback. Deny by default, fail
  closed on error, require Google's `email_verified`.
- Matching is **exact**: `inforvio.com` does not admit `mail.inforvio.com`.
  Implicit suffix matching is the classic allowlist bypass — do not add it.
- **There is no runtime fallback to `BOOTSTRAP_ALLOWED_DOMAINS`.** That env var
  seeds the table; a fallback in the sign-in path would be a bypass. An empty
  table locks everyone out, on purpose.
- Google's `hd` parameter is a UX hint only. It is attacker-controllable and is
  **not** a security control.

## Sessions are database-backed, deliberately

`session: { strategy: "database" }`. A stateless JWT stays valid until it
expires, so it cannot satisfy "deactivating a user or domain cuts access now".
Deleting `session` rows is the revocation point — same reasoning as
`alpha-api`'s `core_user_token.revoked`.

Consequence: Prisma cannot run on the Edge runtime, so **`src/middleware.ts` is
a UX redirect, not a security boundary.** It only checks whether a session
cookie exists. Every real decision happens in Node:

- `(app)/layout.tsx` calls `requireSession()`
- every route handler takes a guard from `src/server/auth/guards.ts`

`withApiHandler` takes the guard as its first argument, so an unguarded handler
is not expressible.

## Layout

```
src/app/api/v1/…      route handlers (the only data path)
src/app/(app)/…       authenticated pages
src/app/(auth)/login  sign-in
src/features/<domain>/<screen>/{<screen>.view.tsx,.api.ts,.types.ts}
src/server/{auth,db,http,services,storage}
src/lib/              pure, client-safe helpers + env
```

Conventions carried from `../craft-apex` and `../fingrid-fas`:

- **Endpoints are colocated**, never centralized: each `*.api.ts` declares its
  own path consts and exports TanStack Query hooks. Views never call `fetch` or
  `api.*` directly at the page level — go through a hook.
- `src/components/ui/` is shadcn primitives **only**.
- Envelope: `{data}` / `{error:{code,message,request_id}}`. Codes live in
  `src/server/http/codes.ts` and are part of the API contract — never renumber.
- Pagination: `?page=1&per_page=20` → `{data, meta:{total,page,per_page}}`.
- Soft delete via `deleted_at`; deleted rows are never returned.
- **No MySQL ENUM.** Status/role/priority are `VarChar(32)`; the allowed values
  live in `src/lib/constants.ts` as zod unions and MUST be validated on write.
- Activity logging happens in the **service** layer, never a route handler.
- Server Actions are used only for auth transitions (`signIn`/`signOut`).
  Everything else is a route handler, so there is one testable HTTP contract.

## Prisma 7 specifics

- Generator is `prisma-client` (not `prisma-client-js`), output
  `src/generated/prisma` — import from `@/generated/prisma/client`.
- `schema.prisma` has **no** datasource `url`. The connection is assembled from
  the discrete `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME`
  variables by `src/lib/database-config.ts` — there is no `DATABASE_URL`.
  - The **runtime** client passes a config *object* to the
    `@prisma/adapter-mariadb` driver adapter, so a password containing `@`, `:`,
    `/` or `#` needs no escaping.
  - The **CLI** only understands a URL, so `prisma.config.ts` composes one with
    `buildMysqlUrl()`, which percent-encodes user and password.
  - `prisma.config.ts` imports that helper by **relative** path — the Prisma CLI
    does not resolve the `@/` tsconfig alias.
- Seed command lives in `prisma.config.ts` (`migrations.seed`), not the
  deprecated `prisma.seed` key in package.json.
- `src/generated/prisma` is gitignored and Prisma 7 does **not** generate on
  install, so `prisma generate` runs from both `postinstall` and `build` — drop
  either one and a clean checkout (or a CI/Vercel container) fails with
  `Can't resolve '@/generated/prisma/client'`. Generation needs no database:
  `prisma.config.ts` warns and omits the datasource when `DB_*` is absent,
  because only migrate/studio/seed require a URL.
- The build still needs `DB_NAME` (and friends) present, though: `prisma.ts`
  builds the client at module scope, and `next build` evaluates every route
  module while collecting page data.

## Notifications are an outbox, not fire-and-forget

`notification` rows are written **inside the same transaction path as the change
that caused them**, then delivered after the HTTP response via Next's `after()`.
That ordering is deliberate:

- Email is never sent for a change that rolled back.
- A notification is never lost because SES was down — the row stays `PENDING`
  with its error and attempt count, and is retried on the next flush.
- A slow SES call never delays the user's response.

`MAIL_DRIVER=log` (the default) prints the whole message to the console, so local
development needs no AWS credentials. `MAIL_DRIVER=ses` sends for real.

Rules live in `src/server/notifications/rules.ts` and are unit-tested: never
notify the actor about their own action, never a deactivated account, and a
person who is both mentioned and a watcher gets **one** email (the mention).

Admin diagnostics: `GET /api/v1/admin/notifications` shows delivery state and
counts; `POST` forces a flush, with `?reset_failed=true` to requeue rows that hit
the attempt ceiling — the thing to call after fixing SES configuration.

**Pure logic must not sit behind a Prisma import.** This bit me three times
(`mentions.ts`, `month.ts`, `rules.ts`): a module that imports
`@/server/db/prisma` cannot be unit-tested, because the client is constructed at
module scope and needs the `DB_*` variables. Keep predicates and formatting in `lib/`
or a prisma-free module.

## Gotchas

- `src/lib/env.ts` exposes required values as **lazy getters**. A module-scope
  throw breaks `next build`, which imports every route without secrets present.
- The Google provider does **not** receive `clientId`/`clientSecret` — Auth.js
  reads `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` itself, for the same build reason.
- Attachments live in a **private S3 bucket only** — there is no local-disk
  driver, so `S3_BUCKET` is required for uploads to work at all. Nothing is ever
  written to `public/`, and no presigned URLs are issued: the only read path is
  `GET /api/v1/attachments/:id/download`, which authorizes first.
- Board `position` is gap-spaced integers with midpoint inserts; when a gap
  closes the column is rebalanced in the same transaction
  (`src/lib/board-position.ts`, `tests/board-position.test.ts`).
- Task numbers (`PMT-42`) increment `project.taskSeq` inside the same
  transaction as the insert, or concurrent creates collide on
  `uq_task_project_number`.
- `next-auth` is pinned to an exact beta. Do not float it; betas have shipped
  breaking config changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
