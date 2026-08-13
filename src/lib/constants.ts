/**
 * Enum values for every VarChar(32) status/role/priority column.
 *
 * The house rule (`fingrid-sdd/skills/04-db-schema/SKILL.md`) is no MySQL ENUM
 * types — enums are enforced in the app layer. That makes THIS file the single
 * source of truth: the database will happily store any string, so every write
 * path must validate against the zod schemas below.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Org-level role on `user.role`. Ordered most to least privileged. */
export const ORG_ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;
export const orgRoleSchema = z.enum(ORG_ROLES);
export type OrgRole = (typeof ORG_ROLES)[number];

/** Project-level role on `project_member.role`. */
export const PROJECT_ROLES = ["LEAD", "MEMBER", "VIEWER"] as const;
export const projectRoleSchema = z.enum(PROJECT_ROLES);
export type ProjectRole = (typeof PROJECT_ROLES)[number];

// ---------------------------------------------------------------------------
// Projects, tasks, sprints
// ---------------------------------------------------------------------------

export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "ARCHIVED"] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Board-column semantics, in workflow order — the overall board renders its
 * columns in exactly this sequence.
 *
 * `DONE` is load-bearing: moving a task into a column of this category stamps
 * `task.completed_at`, which is what the burndown and throughput reports read.
 * Every other category is inert to the reports, which is why `CODE_REVIEW` and
 * `TESTING` can sit between `IN_PROGRESS` and `DONE` without touching them:
 * work in review or in test is still open work, and counts as such.
 */
export const STATUS_CATEGORIES = [
  "TODO",
  "IN_PROGRESS",
  "CODE_REVIEW",
  "TESTING",
  "DONE",
] as const;
export const statusCategorySchema = z.enum(STATUS_CATEGORIES);
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const SPRINT_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED"] as const;
export const sprintStatusSchema = z.enum(SPRINT_STATUSES);
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

/** Columns created for every new project. */
export const DEFAULT_TASK_STATUSES = [
  { name: "To Do", category: "TODO", color: "#64708a" },
  { name: "In Progress", category: "IN_PROGRESS", color: "#3185ff" },
  { name: "Code Review", category: "CODE_REVIEW", color: "#8257e5" },
  { name: "Testing", category: "TESTING", color: "#a86a06" },
  { name: "Done", category: "DONE", color: "#0e9a5e" },
] as const satisfies ReadonlyArray<{
  name: string;
  category: StatusCategory;
  color: string;
}>;

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export const ACTIVITY_ENTITY_TYPES = [
  "PROJECT",
  "TASK",
  "COMMENT",
  "ATTACHMENT",
  "SPRINT",
  "TIME_LOG",
  "ALLOWED_DOMAIN",
  "USER",
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

// ---------------------------------------------------------------------------
// Board ordering
// ---------------------------------------------------------------------------

/** Gap left between adjacent task positions so drops can insert at a midpoint. */
export const BOARD_POSITION_GAP = 1024;

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

/**
 * Accepted attachment MIME types. An allowlist, not a denylist — anything not
 * named here is rejected outright rather than sanitized.
 */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
