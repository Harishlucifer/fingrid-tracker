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

The outbox also needs a **clock**, because `after()` only runs as a side effect
of a task or comment write: a row whose send failed would otherwise wait for the
next such write, which over a quiet weekend never comes. `GET
/api/cron/notifications` is that scheduled pass, wired up in `vercel.json`.
It is the one endpoint not behind a session guard — a scheduler has no cookie —
so it authenticates a shared secret instead (`CRON_SECRET`, sent by Vercel as
`Authorization: Bearer`). `src/lib/cron-auth.ts` holds the comparison, is
prisma-free and unit-tested, and **denies when the secret is unset**: an
unconfigured deployment locks the endpoint rather than opening it. The
`x-vercel-cron` header is not accepted as proof — it is not a secret, exactly
like Google's `hd`. The scheduled pass deliberately does not reset `FAILED`
rows; that stays the explicit admin action above, or the attempt ceiling would
mean nothing.

It runs **daily**, not often, because Vercel's Hobby plan permits only one cron
run per day — a sub-daily `schedule` is rejected outright at deploy. Treat it as
a floor rather than the mechanism: the after-response flush still delivers on
every task and comment write, so the cron only matters for retrying a send that
failed, and daily means such a row waits at most a day on a silent system. A
tighter loop needs either Vercel Pro or an external scheduler calling the same
URL with the same bearer token. Concurrent flushes are safe either way —
`deliverPending` claims each row with an `updateMany` guarded on
`status: "PENDING"` and skips whatever it loses.

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
- A task's detail screen puts comments, history and time behind **three tabs**,
  and each is a different endpoint. History is `GET /api/v1/tasks/:id/activity`,
  **not** the project feed at `/api/v1/activity` filtered in the browser — it is
  scoped to `entity_type=TASK`, so it answers "who moved this, who assigned it"
  without paging over every event in the project. Two consequences worth
  keeping: ids are resolved to **names on the server** (the payload stores a
  `statusId` because that is what the write changed, and a UUID is not history
  anyone can read), and `task.reordered` is excluded — a same-column drag is a
  board detail that would bury the moves that matter. `updateTask` also no
  longer writes a `task.updated` row when the diff is empty; every reassignment
  used to leave one behind, saying nothing. The payload reading lives in
  `src/lib/task-activity.ts`, prisma-free and unit-tested, because three write
  paths record a status change in three different shapes and all three have to
  come out as one sentence.
- **Attachments can belong to a comment**, via `attachment.comment_id`. Every
  row still carries `task_id`, so authorization stays one hop; the column only
  records where the file was posted. `listAttachments` therefore filters
  `commentId: null` — the Files panel is the task's own files, and a comment
  renders its own — while `attachment_count` deliberately counts both, because
  the paperclip on a board card means "this task has files". Posting is two
  requests, uploads first, then the comment **claims** them by id: the claim's
  `where` is the whole authorization argument (same task, same uploader, not
  already claimed) and a partial match is refused rather than quietly posting
  fewer files than the author attached. Deleting a comment soft-deletes its
  files and removes the bytes, because a file reachable only through a deleted
  comment is bytes nobody can see or remove.
- Time entries are editable: `PATCH /api/v1/time-logs/:id`, same permission as
  the delete (your own, or an admin correcting the record) because an edit that
  could rewrite someone else's hours is a delete and a create wearing a
  different name. `spentOn` is re-validated against today exactly as a new entry
  is — moving the day is what pulls an entry into or out of a timesheet week.
- **`task.stage` is a third axis, and the one most likely to be confused with
  the other two.** `status_id` says which column, `completed_at` says when the
  task reached a DONE column, and `stage` says only whether the board shows it
  at all (`BACKLOG` / `ACTIVE` / `COMPLETED` / `BLOCKED` — see `TASK_STAGES`).
  So `stage = "COMPLETED"` is **not** `completed_at`: signing a task off leaves
  that timestamp alone, and **no report may filter on `stage`**, or last
  quarter's throughput would change because somebody tidied the board today.
  The board is `stage: "ACTIVE"` in `getBoard` **and** `getOverallBoard`; the
  backlog screen is `stage: "BACKLOG"`; everything else is reachable from the
  List tab's stage filter and nowhere else.
- The gate is why `assertWipAllows` counts `stage: "ACTIVE"` as well as
  `deleted_at: null`. Counting signed-off tasks would let a Done column fill to
  its limit permanently and then refuse every future move into it — a limit
  nobody could clear, because the tasks holding it are no longer on the board to
  move out.
- Stage transitions live in `src/lib/task-stage.ts`, prisma-free and unit-tested
  over every `TASK_STAGES²` pair, so adding a stage makes each new pair illegal
  until somebody writes it down. Two rules are worth knowing without reading it:
  sign-off is only legal **from a DONE-category column** (otherwise "Done" means
  nothing), and both terminal stages can be reopened (`BLOCKED` exists so that
  someone comes back to it).
- `PATCH /api/v1/tasks/:id/stage` guards at **EDIT** and enforces **MANAGE**
  inside the service, because the level required depends on the target stage —
  marking work ready is ordinary editing, signing it off is not — and a guard
  runs before the body is parsed. Same shape as the comment and time-log routes.
  `POST /api/v1/projects/:id/sign-off` is the bulk form and guards MANAGE at the
  route, because nothing cheaper hides in it. It writes **one** activity row,
  not one per task, for the same reason `updateProjectStatus` does.
- New tasks default to `stage: "BACKLOG"` so nothing reaches the board
  unreviewed. The board's own per-column "add task" dialog passes `ACTIVE`
  explicitly — dropping a card into a column *is* the statement that the work is
  live, and a button that filed it out of sight would be a strange one.
- Board columns are editable at `…/projects/:id/statuses` and need **MANAGE**,
  not EDIT — they define the workflow everyone else works inside. Two couplings
  to respect: a column's `category` drives `task.completed_at`, so changing it
  re-stamps the tasks already there in the same transaction (otherwise the board
  and every report disagree); and `task.status_id` has no `ON DELETE`, so a
  column cannot be dropped while **any** row references it — soft-deleted tasks
  included. Deletes therefore take `?move_to=`. Re-ordering sends the whole new
  order, not one move, so concurrent drags cannot interleave.
- WIP limits are a **server** rule, chosen per project by `project.wip_policy`
  (`DISABLED` / `WARN` / `ENFORCE`, default `WARN` — what the board did when the
  limit was decorative). The predicate is `src/lib/wip-policy.ts`, prisma-free
  and unit-tested; `assertWipAllows` in `task.service.ts` applies it on **all
  four** paths that can place a task in a column — create, update, board move,
  category move — because the board is not the only door. Two rules that are
  easy to break: the moving task is excluded from the occupancy count, and a
  same-column reorder is never checked, so reaching a limit caps a column
  instead of freezing it. Counting then writing is not atomic, so a genuine race
  can leave a column one over; the next move is refused.
- `next-auth` is pinned to an exact beta. Do not float it; betas have shipped
  breaking config changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
