export type UserRef = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type ProjectListItem = {
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
  my_access: "NONE" | "VIEW" | "EDIT" | "MANAGE";
  task_count: number;
  open_task_count: number;
};

export type CreateProjectInput = {
  key: string;
  name: string;
  description?: string;
};
