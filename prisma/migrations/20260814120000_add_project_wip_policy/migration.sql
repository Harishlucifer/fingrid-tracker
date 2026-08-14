-- Per-project WIP policy: what `task_status.wip_limit` actually does.
--
-- Until now the limit was decorative. The board drew an overflow warning from
-- it, but no write path read it, so any client could move a task into a full
-- column through the API. This column is the choice that makes the limit real:
-- DISABLED (ignore it), WARN (flag it, allow it), ENFORCE (refuse the move).
--
-- VarChar(32) with an app-side zod union rather than a MySQL ENUM, matching
-- `status` and `priority` — see the "No MySQL ENUM" rule in AGENTS.md. The
-- allowed values live in WIP_POLICIES in `src/lib/constants.ts` and are
-- validated on write.
--
-- Existing rows default to WARN, which is exactly what the product did before
-- this column existed. That matters for a deployment that is already live: no
-- board changes behaviour when this lands, and no team is suddenly refused a
-- move it was allowed to make yesterday. Enforcement is opt-in, per project.
--
-- Forward-compatible with the running application, so it is safe to apply
-- BEFORE deploying the code that reads it: the old code never selects this
-- column. The reverse is not true — deploying first would have Prisma select a
-- column that does not exist yet — so apply this, then deploy.

ALTER TABLE `project`
  ADD COLUMN `wip_policy` VARCHAR(32) NOT NULL DEFAULT 'WARN' AFTER `color`;
