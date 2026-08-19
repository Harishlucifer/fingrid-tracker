"use client";

import { ArrowRight, Inbox, Layers, PlayCircle, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { DueDate, PriorityBadge, formatMinutes } from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";

import type { TaskCard } from "../board/board.types";
import {
  useAssignSprint,
  useBacklog,
  useProjectSprints,
  useSetTaskStage,
  useSprintTasks,
} from "./backlog.api";

/**
 * Planning: the backlog on one side, the selected sprint on the other.
 *
 * The backlog side is also the **gate onto the board**. Nothing filed here is
 * visible on the board until somebody marks it ready, which is what stops To Do
 * from being an inbox of everything anyone ever thought of. Scheduling into a
 * sprint is a separate question and stays a separate button — a task can be
 * ready without being committed, and committed without being ready.
 *
 * Deliberately buttons rather than drag-and-drop. Planning moves items between
 * two long lists that often need scrolling, where a click is more reliable and
 * far more accessible than a drag; the board is where dragging earns its place.
 */
export function BacklogView({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [backlogPage, setBacklogPage] = useState(1);
  const {
    data: backlog,
    isLoading,
    isFetching: backlogFetching,
  } = useBacklog(projectId, backlogPage);
  const { data: sprints } = useProjectSprints(projectId);
  const assignSprint = useAssignSprint(projectId);
  const setStage = useSetTaskStage(projectId);

  // Default to the active sprint — that is what a planner is usually filling.
  const defaultSprintId = useMemo(() => {
    const active = sprints?.find((sprint) => sprint.status === "ACTIVE");
    return active?.id ?? sprints?.[0]?.id ?? null;
  }, [sprints]);

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const sprintId = selectedSprintId ?? defaultSprintId;
  const { data: sprintTasks } = useSprintTasks(projectId, sprintId);

  const selectedSprint = sprints?.find((sprint) => sprint.id === sprintId);
  const backlogTasks = backlog?.data ?? [];
  const committed = sprintTasks?.data ?? [];

  const backlogEstimate = backlogTasks.reduce(
    (sum, task) => sum + (task.estimate_minutes ?? 0),
    0,
  );
  const committedEstimate = committed.reduce(
    (sum, task) => sum + (task.estimate_minutes ?? 0),
    0,
  );

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="text-muted-foreground size-4" />
            Backlog
            <Badge variant="secondary" className="tnum ml-1 text-[10px]">
              {backlogTasks.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Not on the board yet · {formatMinutes(backlogEstimate)} estimated
            {backlog && backlog.meta.total > backlogTasks.length
              ? ` on this page of ${backlog.meta.total}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : backlogTasks.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Backlog is empty"
              hint="Everything filed in this project is already on the board. New tasks land here until somebody marks them ready."
            />
          ) : (
            <ul className="divide-y">
              {backlogTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  action={
                    canEdit ? (
                      <div className="flex shrink-0 items-center gap-1">
                        {/* The gate. Scheduling into a sprint is the button
                            beside it, and neither implies the other. */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          disabled={setStage.isPending}
                          onClick={() =>
                            setStage.mutate({
                              taskId: task.id,
                              stage: "ACTIVE",
                            })
                          }
                          title="Put this task on the board"
                        >
                          <PlayCircle className="size-3.5" />
                          Ready
                          <span className="sr-only">
                            Mark {task.ref} ready and put it on the board
                          </span>
                        </Button>
                        {sprintId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            disabled={assignSprint.isPending}
                            onClick={() =>
                              assignSprint.mutate({ taskId: task.id, sprintId })
                            }
                            title={`Move to ${selectedSprint?.name ?? "sprint"}`}
                          >
                            <ArrowRight className="size-4" />
                            <span className="sr-only">
                              Move {task.ref} to{" "}
                              {selectedSprint?.name ?? "sprint"}
                            </span>
                          </Button>
                        ) : null}
                      </div>
                    ) : null
                  }
                />
              ))}
            </ul>
          )}
          {backlog && (
            <div className="px-4 pb-4">
              <Pager
                meta={backlog.meta}
                disabled={backlogFetching}
                onPageChange={setBacklogPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="text-muted-foreground size-4" />
                Sprint
                <Badge variant="secondary" className="tnum ml-1 text-[10px]">
                  {committed.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                {selectedSprint
                  ? `${formatMinutes(committedEstimate)} committed · ${selectedSprint.status}`
                  : "No sprint selected"}
              </CardDescription>
            </div>

            {sprints && sprints.length > 0 && (
              <Select
                value={sprintId ?? ""}
                onValueChange={(value) => setSelectedSprintId(value)}
              >
                <SelectTrigger className="w-44 shrink-0">
                  <SelectValue placeholder="Choose sprint" />
                </SelectTrigger>
                <SelectContent>
                  {sprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!sprints || sprints.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No sprints yet"
              hint="Create a sprint before planning. Tasks stay in the backlog until there is somewhere to put them."
              action={
                canEdit ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/projects/${projectId}/sprints`}>
                      Create a sprint
                    </Link>
                  </Button>
                ) : null
              }
            />
          ) : committed.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Nothing committed yet"
              hint="Move tasks in from the backlog to plan this sprint."
            />
          ) : (
            <ul className="divide-y">
              {committed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  action={
                    canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground shrink-0"
                        disabled={assignSprint.isPending}
                        onClick={() =>
                          assignSprint.mutate({
                            taskId: task.id,
                            sprintId: null,
                          })
                        }
                        title="Return to backlog"
                      >
                        <Undo2 className="size-4" />
                        <span className="sr-only">
                          Return {task.ref} to the backlog
                        </span>
                      </Button>
                    ) : null
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskRow({
  task,
  action,
}: {
  task: TaskCard;
  action?: React.ReactNode;
}) {
  return (
    <li className="hover:bg-secondary/40 flex items-center gap-3 px-4 py-3 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground tnum font-mono text-[11px]">
            {task.ref}
          </span>
          <PriorityBadge priority={task.priority} />
          {task.completed_at && (
            <Badge
              variant="secondary"
              className="bg-success-bg text-success text-[10px]"
            >
              Done
            </Badge>
          )}
        </div>

        <Link
          href={`/tasks/${task.id}`}
          className="hover:text-accent mt-1 block truncate text-sm font-medium"
        >
          {task.title}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-xs">
            {task.status.name}
          </span>
          <DueDate dueDate={task.due_date} completedAt={task.completed_at} />
          {task.estimate_minutes ? (
            <span className="text-muted-foreground tnum text-xs">
              {formatMinutes(task.estimate_minutes)} est
            </span>
          ) : null}
        </div>
      </div>

      {task.assignee && (
        <UserAvatar user={task.assignee} size="xs" className="shrink-0" />
      )}
      {action}
    </li>
  );
}
