-- Code Review and Testing become board stages of their own.
--
-- No schema change: `task_status.category` is a VarChar(32) whose allowed values
-- live in `src/lib/constants.ts` (STATUS_CATEGORIES), and board columns are
-- ordinary rows. New projects pick the five columns up from
-- DEFAULT_TASK_STATUSES; projects that already exist were created with three, so
-- the two new stages are backfilled here.
--
-- Positions are the gap-spaced integers described in `src/lib/board-position.ts`
-- (BOARD_POSITION_GAP = 1024). Widening the gap in front of the done column
-- leaves room for exactly two stages, so nothing else has to be renumbered and
-- any ordering a project already had is preserved.

UPDATE `task_status`
SET `position` = `position` + 2048
WHERE `category` = 'DONE';

INSERT INTO `task_status`
  (`id`, `project_id`, `name`, `category`, `position`, `color`, `created_at`, `updated_at`)
SELECT
  UUID(),
  `p`.`id`,
  'Code Review',
  'CODE_REVIEW',
  (
    SELECT MIN(`d`.`position`) - 2048
    FROM `task_status` `d`
    WHERE `d`.`project_id` = `p`.`id` AND `d`.`category` = 'DONE'
  ),
  '#8257e5',
  NOW(3),
  NOW(3)
FROM `project` `p`
WHERE
  -- Skip a project with no done column: there is no gap to place these in, and
  -- guessing a position would put the stages in the wrong order.
  EXISTS (
    SELECT 1 FROM `task_status` `d`
    WHERE `d`.`project_id` = `p`.`id` AND `d`.`category` = 'DONE'
  )
  -- Re-runnable, and safe for a project that somehow already has the column.
  AND NOT EXISTS (
    SELECT 1 FROM `task_status` `s`
    WHERE `s`.`project_id` = `p`.`id`
      AND (`s`.`category` = 'CODE_REVIEW' OR `s`.`name` = 'Code Review')
  );

INSERT INTO `task_status`
  (`id`, `project_id`, `name`, `category`, `position`, `color`, `created_at`, `updated_at`)
SELECT
  UUID(),
  `p`.`id`,
  'Testing',
  'TESTING',
  (
    SELECT MIN(`d`.`position`) - 1024
    FROM `task_status` `d`
    WHERE `d`.`project_id` = `p`.`id` AND `d`.`category` = 'DONE'
  ),
  '#a86a06',
  NOW(3),
  NOW(3)
FROM `project` `p`
WHERE
  EXISTS (
    SELECT 1 FROM `task_status` `d`
    WHERE `d`.`project_id` = `p`.`id` AND `d`.`category` = 'DONE'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `task_status` `s`
    WHERE `s`.`project_id` = `p`.`id`
      AND (`s`.`category` = 'TESTING' OR `s`.`name` = 'Testing')
  );
