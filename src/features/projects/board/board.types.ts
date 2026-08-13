import type { UserRef } from "../list/list.types";

export type TaskCard = {
  id: string;
  ref: string;
  number: number;
  title: string;
  description: string | null;
  type: string;
  priority: string;
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

export type Board = { columns: BoardColumn[] };

export type ProjectDetail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  owner: UserRef;
  statuses: {
    id: string;
    name: string;
    category: string;
    position: number;
    color: string | null;
    wip_limit: number | null;
  }[];
  members: { id: string; role: string; user: UserRef }[];
};

export type MoveTaskInput = {
  taskId: string;
  statusId: string;
  beforeTaskId?: string | null;
  afterTaskId?: string | null;
};
