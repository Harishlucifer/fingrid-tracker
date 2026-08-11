-- CreateTable
CREATE TABLE `notification` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NOT NULL,
    `type` VARCHAR(48) NOT NULL,
    `entity_type` VARCHAR(32) NOT NULL,
    `entity_id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NULL,
    `to_email` VARCHAR(320) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `body_text` TEXT NOT NULL,
    `body_html` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` VARCHAR(1000) NULL,
    `provider_message_id` VARCHAR(255) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ix_notification_delivery`(`status`, `created_at`),
    INDEX `ix_notification_user`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
