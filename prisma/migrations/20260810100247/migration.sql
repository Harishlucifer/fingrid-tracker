-- CreateTable
CREATE TABLE `user` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NULL,
    `email` VARCHAR(320) NOT NULL,
    `email_verified` DATETIME(3) NULL,
    `image` VARCHAR(1024) NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uq_user_email`(`email`),
    INDEX `ix_user_is_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `provider` VARCHAR(64) NOT NULL,
    `provider_account_id` VARCHAR(255) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(64) NULL,
    `scope` VARCHAR(1024) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ix_account_user`(`user_id`),
    UNIQUE INDEX `uq_account_provider`(`provider`, `provider_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` CHAR(36) NOT NULL,
    `session_token` VARCHAR(255) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `expires` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_session_token`(`session_token`),
    INDEX `ix_session_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_token` (
    `identifier` VARCHAR(320) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_verification_token`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `allowed_domain` (
    `id` CHAR(36) NOT NULL,
    `domain` VARCHAR(253) NOT NULL,
    `auto_role` VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(500) NULL,
    `created_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_allowed_domain`(`domain`),
    INDEX `ix_allowed_domain_is_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(16) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `color` VARCHAR(16) NULL,
    `owner_id` CHAR(36) NOT NULL,
    `task_seq` INTEGER NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uq_project_key`(`key`),
    INDEX `ix_project_status`(`status`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_member` (
    `id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ix_project_member_user`(`user_id`),
    UNIQUE INDEX `uq_project_member`(`project_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_status` (
    `id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `category` VARCHAR(32) NOT NULL DEFAULT 'TODO',
    `position` INTEGER NOT NULL,
    `color` VARCHAR(16) NULL,
    `wip_limit` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ix_task_status_order`(`project_id`, `position`),
    UNIQUE INDEX `uq_task_status_name`(`project_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task` (
    `id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `status_id` CHAR(36) NOT NULL,
    `sprint_id` CHAR(36) NULL,
    `number` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `priority` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    `assignee_id` CHAR(36) NULL,
    `reporter_id` CHAR(36) NOT NULL,
    `due_date` DATETIME(3) NULL,
    `estimate_minutes` INTEGER NULL,
    `position` INTEGER NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ix_task_board`(`project_id`, `status_id`, `position`),
    INDEX `ix_task_assignee`(`assignee_id`, `completed_at`),
    INDEX `ix_task_sprint`(`sprint_id`),
    INDEX `ix_task_project_live`(`project_id`, `deleted_at`),
    UNIQUE INDEX `uq_task_project_number`(`project_id`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment` (
    `id` CHAR(36) NOT NULL,
    `task_id` CHAR(36) NOT NULL,
    `author_id` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `parent_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ix_comment_task`(`task_id`, `created_at`),
    INDEX `ix_comment_parent`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mention` (
    `id` CHAR(36) NOT NULL,
    `comment_id` CHAR(36) NOT NULL,
    `mentioned_user_id` CHAR(36) NOT NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_mention_user_unread`(`mentioned_user_id`, `read_at`),
    UNIQUE INDEX `uq_mention`(`comment_id`, `mentioned_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attachment` (
    `id` CHAR(36) NOT NULL,
    `task_id` CHAR(36) NOT NULL,
    `uploader_id` CHAR(36) NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `checksum` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uq_attachment_storage_key`(`storage_key`),
    INDEX `ix_attachment_task`(`task_id`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_log` (
    `id` CHAR(36) NOT NULL,
    `entity_type` VARCHAR(32) NOT NULL,
    `entity_id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NULL,
    `actor_id` CHAR(36) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_activity_project`(`project_id`, `created_at`),
    INDEX `ix_activity_entity`(`entity_type`, `entity_id`, `created_at`),
    INDEX `ix_activity_actor`(`actor_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sprint` (
    `id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `goal` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ix_sprint_project_status`(`project_id`, `status`),
    UNIQUE INDEX `uq_sprint_name`(`project_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_log` (
    `id` CHAR(36) NOT NULL,
    `task_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `minutes` INTEGER NOT NULL,
    `spent_on` DATE NOT NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ix_time_log_task`(`task_id`, `deleted_at`),
    INDEX `ix_time_log_user_date`(`user_id`, `spent_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_member` ADD CONSTRAINT `project_member_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_member` ADD CONSTRAINT `project_member_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_status` ADD CONSTRAINT `task_status_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_status_id_fkey` FOREIGN KEY (`status_id`) REFERENCES `task_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_sprint_id_fkey` FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment` ADD CONSTRAINT `comment_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment` ADD CONSTRAINT `comment_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment` ADD CONSTRAINT `comment_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `comment`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `mention` ADD CONSTRAINT `mention_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mention` ADD CONSTRAINT `mention_mentioned_user_id_fkey` FOREIGN KEY (`mentioned_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachment` ADD CONSTRAINT `attachment_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachment` ADD CONSTRAINT `attachment_uploader_id_fkey` FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sprint` ADD CONSTRAINT `sprint_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_log` ADD CONSTRAINT `time_log_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_log` ADD CONSTRAINT `time_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
