# Next phase: feature gaps and delivery plan

**Status:** draft — derived from the current codebase, not from stakeholder
interviews. Confirm the priorities with the people who use the tool before
committing to a release.

The gaps below were re-checked against the code on 2026-08-14. Deployment notes
describe the current Vercel project (`vercel.json`, region `bom1`).

**Increment 0 and increment 1 have since been delivered** — the scheduled outbox
flush, pull-request CI, server-side WIP policy, the project details editor, and
board-column management. Those sections are marked `Delivered` below and kept
rather than deleted, because the reasoning behind them is what the remaining
increments are sequenced against. Everything not marked is still outstanding.

## Current baseline

Inforvio PM already covers the core team workflow:

- Google-only, allowlisted sign-in; organisation and project roles; immediate
  session revocation.
- Projects, membership, a per-project Kanban board, a cross-project board,
  backlog, sprints, task types/priorities, due dates, estimates, and time logs.
- Task descriptions, threaded comments with @mentions, private S3 attachments,
  activity recording, email notification delivery, dashboards, and reports.

The items below are missing capabilities, not a list of work that is already
implemented. Priorities balance user value with the risk of building more
planning features on an inflexible workflow.

## Recommended product scope

### P0 — configurable project workflow — **Delivered**

**Gap (as found):** Project settings show board columns but cannot create, rename, reorder,
change category/colour, or remove them. Project metadata has an update API
(`PATCH /api/v1/projects/:id` → `updateProject`) but no corresponding settings
experience — `settings.view.tsx` only adds and removes members. WIP limits are
displayed as an overflow warning only: `moveTask` validates that the target
status belongs to the project and never reads `wip_limit`, so moving a task into
a full column is allowed, and the API is a trivial bypass of a rule the board
already implies.

**Deliver:**

- A project details editor for name, description, dates, colour, and lifecycle
  status.
- Board-column management for project leads: create, edit, reorder, archive,
  category, colour, and WIP limit.
- Server-side WIP-limit policy with an explicit project-level choice: enforce,
  warn, or disabled. The server must remain authoritative for moves and creates.
- Safe handling for columns that contain tasks: require a destination column
  before archiving or deleting one.

**Done when:** A lead can tailor a project workflow without database work; a
member cannot bypass the chosen WIP policy through either the board or API; and
the board and reports remain correct after a column change.

**What shipped.** `project.wip_policy` (`DISABLED` / `WARN` / `ENFORCE`,
defaulting to `WARN` so no existing board changed behaviour) with the rule in
`src/lib/wip-policy.ts` and `assertWipAllows` applied on all four paths that can
place a task in a column — create, update, board move, category move. A project
details editor, and column create/edit/reorder/delete under MANAGE at
`…/projects/:id/statuses`. A category change re-stamps `task.completed_at` on
the tasks already in the column, in the same transaction, so the board and the
reports cannot disagree. Deleting a column that holds work requires `?move_to=`.

**Two deliverables were not built, deliberately:**

- **Archiving a column.** `task_status` has no `archived_at`, so it needs a
  migration of its own, and delete-with-destination already covers the safety
  requirement. Decide whether archive earns a column before adding one.
- **Enforcement on the WIP check is not atomic.** Counting and writing are
  separate statements, so a genuine race can leave a column one over its limit;
  the next move is refused. Row-locking a whole column on every move costs more
  than that is worth at this scale. Revisit only if it is ever observed.

### P0 — work decomposition and delivery constraints

**Gap:** A task is a flat record. There are no epics, subtasks/checklists,
milestones, linked work, blockers, or dependency-aware planning.

**Deliver:**

- Parent/child tasks with progress derived from their children.
- A lightweight checklist for work that does not deserve a separate task.
- Directed task dependencies such as `blocks` and `is blocked by`, including
  cycle prevention and a visible blocked state on board and task views.
- Milestones or epics that group tasks across a project, with target date and
  progress.

**Done when:** Teams can express a feature's work breakdown, see why a task is
blocked, and avoid closing a parent as complete while required children remain
open. Dependency and completion rules need service-level tests.

**Confirm before starting.** This is the largest item in the plan — new tables,
cycle detection, and parent-completion rules — and it is currently justified by
the shape of the schema (`Task` has no `parent_id`; only `Comment` does, for
threading) rather than by reported user pain. Get demand confirmed before
committing to it. The workflow item above does not need the same confirmation,
because the board already displays a limit the server does not enforce.

### P1 — task organisation, discovery, and personal views

**Gap:** Tasks can be filtered inside one project by title, status, type,
priority, and open state. There is no label system, full-text/cross-project
search, saved filter, or due-date-oriented personal planning view.

**Deliver:**

- Project-scoped labels with colours, filtering, and bulk add/remove actions.
- A global search that respects visible-project access and searches task key,
  title, description, and comments. Start with indexed database search before
  introducing an external search service.
- Filters for assignee, reporter, sprint, due-date range, overdue, blocked,
  label, and unestimated work; persist them in the URL for shareable views.
- Saved personal views, including “due this week”, “unassigned”, and “blocked”.

**Done when:** A user can locate a known task from any page and can return to a
saved, shareable work view without recreating its filters.

### P1 — activity and in-app notifications

**Gap:** The service layer writes an audit trail and there is an activity API,
but there is no activity feed in the application. Notifications are durable
email-outbox rows; users have no in-app notification centre or preferences.

**Deliver:**

- A chronological project activity feed and task-history tab that renders
  human-readable changes from the existing audit payloads.
- An in-app inbox for assignments, mentions, comments, blocked/dependency
  changes, and due-date reminders, with read/unread state and deep links.
- Per-user channel preferences (in-app and email), with safe defaults that
  preserve the existing “never notify the actor” rule.

**Done when:** A teammate can answer “what changed?” from the project or task,
and can clear or revisit actionable notifications without relying on email.

### P2 — reporting, sharing, and integrations

**Gap:** Current reporting is limited to project summary, throughput, workload,
burndown, and timesheet pages. There is no export, scheduled report, calendar
view, or integration surface.

**Deliver:**

- CSV export for task lists, project reports, and approved time reports, using
  the same access checks and active filters as the screen.
- Date-based calendar and milestone views for planned work and due dates.
- Scheduled weekly digest emails, built on the existing outbox rather than a
  separate fire-and-forget sender.
- A small, versioned webhook surface for task/sprint events, signed with a
  per-project secret and retried through an outbox.

**Done when:** An authorised user can export exactly the data they see, and an
external system can reliably receive a documented, authenticated event without
being able to access project data directly.

## Release-readiness work (do before wider production use)

These are not end-user features, but they are the most important missing
operational capabilities.

Vercel already covers part of the verification story: the build script runs
`prisma generate && next build`, and on Next 16 `next build` type-checks by
default (`typescript.il`, the renamed `ignoreBuildErrors`, is unset and defaults
to `false`). Generation, typecheck, and build are therefore gated on every
deploy. Two gates are not: ESLint is decoupled from `next build` in Next 16, so
`npm run lint` never runs, and the Vitest suite has no automatic trigger at all.
A deploy is also a post-merge gate — a failure is reported once the commit has
already landed.

1. **The notification outbox has no clock — Delivered.** The after-response flush was called
   from three endpoints only — task create, task update, and comment create —
   plus the manual `POST /api/v1/admin/notifications`. `vercel.json` defines no
   cron jobs. A row whose delivery fails therefore stays `PENDING` until someone
   happens to write a task or a comment; over a quiet period it is never
   retried. `GET /api/cron/notifications` is now that scheduled flush, run from
   `vercel.json`. Vercel cron issues an unauthenticated `GET` while the admin
   endpoint is `POST` behind `requireAdmin()`, so it authenticates a shared
   `CRON_SECRET` instead, and denies when that is unset. **Set `CRON_SECRET` on
   the Vercel project** — until then the platform sends no credential and the
   endpoint correctly refuses its own cron.

   It runs **daily**, because the Vercel Hobby plan rejects any sub-daily
   schedule at deploy time. That is a real reduction in the guarantee: a send
   that fails can now wait a day rather than ten minutes. It is a floor, not the
   mechanism — the after-response flush still delivers on every task and comment
   write — but if retry latency matters, the options are Vercel Pro or an
   external scheduler calling the same URL with the same bearer token.
   Concurrent flushes are safe: rows are claimed with a guarded `updateMany`.

2. **Automated verification — partly delivered.** `bitbucket-pipelines.yml` runs
   `lint`, `typecheck` and `test` on every pull request. `build` is left to
   Vercel, which needs the `DB_*` variables anyway. Note the budget: Bitbucket's
   free tier allows 50 build minutes a month and this step costs about three, so
   it is deliberately scoped to pull requests rather than every branch push.
   Still outstanding: enable **preview deployments**, so the typecheck and build
   Vercel already runs happen before merge rather than after; and add
   browser/API integration coverage for sign-in denial, role boundaries, project
   isolation, task moves, uploads, and notification-outbox retry. Adding
   `format:check` to CI needs a repository-wide Prettier commit first — 148
   files are not currently clean.
3. **Observability and alerting.** Emit structured logs with request IDs,
   capture unhandled errors, and monitor readiness, database connectivity, S3,
   and email delivery failures. Alert on a growing pending/failed notification
   queue. Record the database's `max_connections` ceiling and alert before it is
   reached: serverless functions each hold MySQL connections through the
   MariaDB adapter, which is the usual way this architecture first fails under
   load.
4. **Recovery and data lifecycle.** Define MySQL backup/restore ownership and
   test restoration; document S3 versioning/lifecycle and a process for
   restoring soft-deleted records. Add retention rules for audit and
   notification records once legal/business requirements are known.
5. **Accessibility and performance checks.** Test keyboard board movement,
   screen-reader workflows, focus handling in dialogs, and responsive layouts;
   measure and paginate large boards, activity feeds, and search results.

## Suggested delivery sequence

| Increment | Scope                                                 | Why first                                                                                                                     |
| --------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0 ✅      | Scheduled outbox flush, lint/test CI                  | Done. Preview deployments are the one part left — a dashboard toggle, not code.                                               |
| 0.5       | Integration tests, monitoring, backup/restore runbook | **Do this next.** Makes later changes safe to ship and support; needs a test database, which increments 2–4 will want anyway. |
| 1 ✅      | WIP enforcement, project editor, column management    | Done, apart from column archiving. Teams can now use their real workflow before more planning data is added.                  |
| 2         | Subtasks, dependencies, milestones, activity feed     | Adds execution visibility and meaningful delivery constraints.                                                                |
| 3         | Labels, global search, saved views, in-app inbox      | Makes the growing volume of work manageable for individuals.                                                                  |
| 4         | Exports, calendar, scheduled digests, signed webhooks | Extends the mature workflow to reporting and connected tools.                                                                 |

## Guardrails for the next phase

- Preserve exact, database-backed domain allowlisting and server-side access
  checks; do not add an environment-variable fallback in the sign-in path.
- Keep every new mutation behind the existing route-handler guards, service
  layer, activity logging, and transactional notification-outbox pattern.
- The scheduled-flush route is the single endpoint that will not sit behind a
  session guard. It must authenticate a shared cron secret, return no project
  data, and remain the only such exception — not a precedent for unguarded
  routes.
- Keep upload/download authorisation private; integrations must not introduce
  public attachment URLs.
- Treat custom fields, external issue trackers, enterprise provisioning, and
  native mobile apps as separate discovery efforts. They should not enter the
  next phase without a demonstrated user need.
