"use client";

import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { TypeBadge } from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, buildQuery } from "@/lib/api-client";
import { TASK_PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useProject } from "../board/board.api";
import type { TaskCard } from "../board/board.types";

const URL_TASKS = "/api/v1/tasks";

/** Flat, filterable table view of a project's tasks — the board's counterpart. */
export function TaskListView({ projectId }: { projectId: string }) {
  const [search, setSearch] = useState("");
  const [statusId, setStatusId] = useState("all");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);

  const { data: project } = useProject(projectId);

  const { data, isLoading } = useQuery({
    queryKey: [
      "task-list",
      projectId,
      search,
      statusId,
      type,
      priority,
      openOnly,
    ] as const,
    queryFn: () =>
      api.getPaged<TaskCard[]>(
        `${URL_TASKS}${buildQuery({
          projectId,
          q: search || undefined,
          statusId: statusId === "all" ? undefined : statusId,
          type: type === "all" ? undefined : type,
          priority: priority === "all" ? undefined : priority,
          open: openOnly ? "true" : undefined,
          per_page: 100,
        })}`,
      ),
  });

  const tasks = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search titles"
          className="w-full sm:w-64"
        />

        <Select value={statusId} onValueChange={setStatusId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {project?.statuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TASK_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {TASK_PRIORITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
            className="accent-accent size-4"
          />
          Open only
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-muted-foreground py-16 text-center text-sm">
              <ListChecks className="mx-auto mb-3 size-8 opacity-40" />
              No tasks match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Ref</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="w-40">Assignee</TableHead>
                    <TableHead className="w-28">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const overdue =
                      task.due_date !== null &&
                      task.completed_at === null &&
                      new Date(task.due_date) < new Date();

                    return (
                      <TableRow key={task.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {task.ref}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/tasks/${task.id}`}
                            className="hover:text-accent text-sm font-medium"
                          >
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {task.status.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TypeBadge type={task.type} />
                        </TableCell>
                        <TableCell className="text-xs">{task.priority}</TableCell>
                        <TableCell className="text-muted-foreground truncate text-xs">
                          {task.assignee?.name ?? task.assignee?.email ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            overdue ? "text-danger font-medium" : "text-muted-foreground",
                          )}
                        >
                          {task.due_date
                            ? new Date(task.due_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
