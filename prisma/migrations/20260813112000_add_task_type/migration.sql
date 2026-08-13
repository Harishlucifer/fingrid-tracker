-- Task type: STORY (planned work) or ISSUE (something wrong with what exists).
--
-- VarChar(32) with an app-side zod union rather than a MySQL ENUM, matching
-- `priority` — see the "No MySQL ENUM" rule in AGENTS.md. Adding a value later
-- is then a constants change, not a schema migration.
--
-- Existing rows default to STORY: everything created before this column existed
-- was ordinary planned work, and defaulting to ISSUE would retroactively label
-- the whole backlog as defects.

ALTER TABLE `task`
  ADD COLUMN `type` VARCHAR(32) NOT NULL DEFAULT 'STORY' AFTER `description`;
