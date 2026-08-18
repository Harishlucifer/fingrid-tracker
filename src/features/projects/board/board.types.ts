import type { StatusCategory, TaskStage, WipPolicy } from "@/lib/constants";

import type { UserRef } from "../list/list.types";

export type TaskCard = {
  id: string;
  ref: string;
  number: number;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  /**
   * Whether the board shows this task at all — see TASK_STAGES. Distinct from
   * `status` (which column) and `completed_at` (when it reached Done, which is
   * what the reports read).
   */
  stage: TaskStage;
  position: number;
  due_date: string | null;
  estimate_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  project: { id: string; key: string; name: string };
  status: { id: string; name: string; category: string; position: number };
  sprint: { id: string; name: string } | null;
  assignee: UserRef | null;
  reporter: UserRef;
  comment_count: number;
  attachment_count: number;
};

export type BoardColumn = {
  id: string;
  name: string;
  category: string;
  position: number;
  color: string | null;
  wip_limit: number | null;
  tasks: TaskCard[];
};

export type Board = {
  /** DISABLED | WARN | ENFORCE — see WIP_POLICIES. Decides what a full column means. */
  wip_policy: WipPolicy;
  columns: BoardColumn[];
};

/** A board column as the settings screen sees it — the board's own view is `BoardColumn`. */
export type ProjectColumn = {
  id: string;
  name: string;
  category: StatusCategory;
  position: number;
  color: string | null;
  wip_limit: number | null;
  /** Live tasks only. Zero does not guarantee the column can be deleted: soft-deleted tasks still hold the foreign key. */
  task_count: number;
};

export type ProjectDetail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  wip_policy: WipPolicy;
  created_at: string;
  owner: UserRef;
  statuses: ProjectColumn[];
  members: { id: string; role: string; user: UserRef }[];
};

export type MoveTaskInput = {
  taskId: string;
  statusId: string;
  beforeTaskId?: string | null;
  afterTaskId?: string | null;
};
