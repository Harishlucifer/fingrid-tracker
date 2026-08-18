-- Attachments can now belong to a comment, not only to the task.
--
-- `task_id` stays NOT NULL on every row: a comment attachment is still a file
-- on that task, which keeps authorization a single hop (attachment -> task ->
-- project) instead of a branch that has to walk through the comment. The new
-- column only records *where the file was posted*, so the Files panel can list
-- the task's own files (`comment_id IS NULL`) while a comment renders the ones
-- that arrived with it. Without that distinction every file posted in a
-- discussion would be duplicated into the panel above it.
--
-- ON DELETE SET NULL rather than CASCADE: comments are soft-deleted here, so
-- the cascade would almost never fire, and on the day a row really is removed
-- it must not silently destroy the audit trail of a file that was uploaded.
-- The attachment falls back to being a plain task attachment instead.
--
-- Existing rows get NULL, which is exactly right — every attachment created
-- before this migration was posted against the task.
--
-- Forward-compatible with the running application: the old code never selects
-- this column, so apply this first, then deploy.

ALTER TABLE `attachment`
  ADD COLUMN `comment_id` CHAR(36) NULL AFTER `uploader_id`,
  ADD INDEX `ix_attachment_comment` (`comment_id`);

ALTER TABLE `attachment`
  ADD CONSTRAINT `attachment_comment_id_fkey`
  FOREIGN KEY (`comment_id`) REFERENCES `comment`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
