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

/**
 * What kind of work a task represents. `STORY` is planned work; `ISSUE` is
 * something wrong with what already exists. Purely descriptive — nothing in the
 * board, the reports or the notification rules branches on it — so a project can
 * adopt the distinction without either type behaving differently.
 */
export const TASK_TYPES = ["STORY", "ISSUE"] as const;
export const taskTypeSchema = z.enum(TASK_TYPES);
export type TaskType = (typeof TASK_TYPES)[number];

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
/**
 * What may be rendered INLINE in the browser, and as which content type.
 *
 * This is deliberately a separate, much shorter list than
 * `ALLOWED_UPLOAD_MIME_TYPES`: serving user-uploaded bytes inline from our own
 * origin is how stored XSS happens, so the rule is that nothing capable of
 * executing script is ever previewed.
 *
 *  * `image/svg+xml` is uploadable but NOT previewable — an SVG is a document
 *    that can carry `<script>`, and inline it would run as same-origin code in
 *    the viewer's session. It downloads instead.
 *  * `text/*` and JSON are served as `text/plain` rather than echoed back with
 *    their stored type, so nothing can be coaxed into being treated as HTML.
 *  * Office documents and archives are not renderable by a browser anyway.
 *
 * The served type is fixed here rather than taken from the stored row, because
 * the stored MIME comes from the uploader.
 */
export const PREVIEWABLE_MIME_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
  "application/pdf": "application/pdf",
  "text/plain": "text/plain; charset=utf-8",
  "text/csv": "text/plain; charset=utf-8",
  "text/markdown": "text/plain; charset=utf-8",
  "application/json": "text/plain; charset=utf-8",
};

/** How the client should render a previewable file. */
export function previewKindOf(
  mimeType: string,
): "image" | "document" | null {
  if (!(mimeType in PREVIEWABLE_MIME_TYPES)) return null;
  return mimeType.startsWith("image/") ? "image" : "document";
}

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
