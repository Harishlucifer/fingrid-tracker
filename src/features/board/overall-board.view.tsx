"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock3, LayoutGrid, MessageSquare, Paperclip } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  DueDate,
  PriorityBadge,
  formatMinutes,
} from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

import type { TaskCard } from "../projects/board/board.types";
import {
  useMoveTaskCategory,
  useOverallBoard,
  type BoardFilters,
} from "./overall-board.api";

const CATEGORY_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const CATEGORY_DOT: Record<string, string> = {
  TODO: "bg-priority-low",
  IN_PROGRESS: "bg-chart-1",
  DONE: "bg-success",
};

/**
 * Board across every project the user can see.
 *
 * Columns are status *categories*, not per-project columns — two projects'
 * "In Review" are different rows in `task_status` but the same category, and
 * that is the only axis they share. Dropping a card moves it to the matching
 * category inside its own project; a task never changes project.
 */
export function OverallBoardView({ canEdit }: { canEdit: boolean }) {
  const [projectId, setProjectId] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);

  const filters: BoardFilters = {
    projectId: projectId === "all" ? undefined : projectId,
    mineOnly,
  };

  const { data, isLoading } = useOverallBoard(filters);
  const moveCategory = useMoveTaskCategory(filters);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const columns = useMemo(() => data?.columns ?? [], [data]);

  const taskById = useMemo(() => {
    const map = new Map<string, TaskCard>();
    for (const column of columns) {
      for (const task of column.tasks) map.set(task.id, task);
    }
    return map;
  }, [columns]);

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    // `over` is either a column (its category) or another card.
    const targetCategory =
      columns.find((column) => column.category === overId)?.category ??
      columns.find((column) =>
        column.tasks.some((task) => task.id === overId),
      )?.category;

    if (!targetCategory) return;

    const current = columns.find((column) =>
      column.tasks.some((task) => task.id === taskId),
    );
    if (current?.category === targetCategory) return;

    moveCategory.mutate({ taskId, category: targetCategory });
  }

  const totalShown = columns.reduce((sum, column) => sum + column.total, 0);
  const dragging = draggingId ? taskById.get(draggingId) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Board"
        description="Every project you can see, in one board. Columns are shared stages; dragging a card moves it within its own project."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {data?.projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.key} · {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => setMineOnly(event.target.checked)}
            className="accent-accent size-4"
          />
          Only mine
        </label>

        <span className="text-muted-foreground tnum ml-auto text-xs">
          {totalShown} card(s)
        </span>
      </div>

      {data?.truncated && (
        <p className="border-warning/30 bg-warning-bg text-warning rounded-lg border px-3 py-2 text-xs">
          Showing the first 400 tasks only. Filter by project to narrow this down.
        </p>
      )}

      {isLoading ? (
        <div className="flex gap-4">
          <Skeleton className="h-96 w-80 shrink-0" />
          <Skeleton className="h-96 w-80 shrink-0" />
          <Skeleton className="h-96 w-80 shrink-0" />
        </div>
      ) : totalShown === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <EmptyState
              icon={LayoutGrid}
              title="No tasks to show"
              hint={
                mineOnly
                  ? "Nothing is assigned to you in these projects. Clear the filter to see everything."
                  : "Create a task in a project and it will appear here."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(event: DragStartEvent) =>
            setDraggingId(String(event.active.id))
          }
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="board-scroll flex gap-4 pb-4">
            {columns.map((column) => (
              <CategoryColumn
                key={column.category}
                category={column.category}
                tasks={column.tasks}
                canEdit={canEdit}
                showProject={projectId === "all"}
              />
            ))}
          </div>

          <DragOverlay>
            {dragging ? <BoardCard task={dragging} showProject isDragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function CategoryColumn({
  category,
  tasks,
  canEdit,
  showProject,
}: {
  category: string;
  tasks: TaskCard[];
  canEdit: boolean;
  showProject: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category });

  return (
    <section className="bg-secondary/50 flex w-80 shrink-0 flex-col rounded-xl">
      <header className="bg-secondary/50 sticky top-0 z-10 flex items-center gap-2 rounded-t-xl px-3 py-3 backdrop-blur">
        <span
          className={cn("size-2 shrink-0 rounded-full", CATEGORY_DOT[category])}
          aria-hidden="true"
        />
        <h2 className="truncate text-sm font-semibold">
          {CATEGORY_LABEL[category] ?? category}
        </h2>
        <span className="tnum bg-card text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs">
          {tasks.length}
        </span>
      </header>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-28 flex-1 flex-col gap-2 px-2 pb-2 transition-colors",
            isOver && "bg-accent/8",
          )}
        >
          {tasks.map((task) => (
            <SortableCard
              key={task.id}
              task={task}
              disabled={!canEdit}
              showProject={showProject}
            />
          ))}

          {tasks.length === 0 && (
            <p
              className={cn(
                "text-muted-foreground m-1 flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-xs transition-colors",
                isOver && "border-accent text-accent",
              )}
            >
              {isOver ? "Drop here" : "Nothing here"}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  task,
  disabled,
  showProject,
}: {
  task: TaskCard;
  disabled: boolean;
  showProject: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <BoardCard task={task} showProject={showProject} />
    </div>
  );
}

function BoardCard({
  task,
  showProject,
  isDragging,
}: {
  task: TaskCard;
  showProject?: boolean;
  isDragging?: boolean;
}) {
  return (
    <article
      className={cn(
        "bg-card shadow-card space-y-2.5 rounded-lg border p-3 transition-shadow",
        isDragging
          ? "rotate-2 shadow-[var(--shadow-drag)]"
          : "hover:shadow-raised",
      )}
    >
      {showProject && (
        <Link
          href={`/projects/${task.project.id}/board`}
          onPointerDown={(event) => event.stopPropagation()}
          className="text-muted-foreground hover:text-accent block truncate text-[11px] font-medium"
        >
          {task.project.name}
        </Link>
      )}

      <div className="flex items-start gap-2">
        <Link
          href={`/tasks/${task.id}`}
          className="hover:text-accent min-w-0 flex-1 text-sm leading-snug font-medium"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {task.title}
        </Link>
        {task.assignee && (
          <UserAvatar user={task.assignee} size="xs" className="mt-0.5" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PriorityBadge priority={task.priority} />
        <DueDate dueDate={task.due_date} completedAt={task.completed_at} />
        {/* The concrete per-project column, since the header only shows the category. */}
        <Badge variant="outline" className="max-w-28 truncate text-[10px]">
          {task.status.name}
        </Badge>
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
        <span className="tnum font-mono">{task.ref}</span>
        {task.estimate_minutes ? (
          <span className="tnum flex items-center gap-1">
            <Clock3 className="size-3" />
            {formatMinutes(task.estimate_minutes)}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2.5">
          {task.comment_count > 0 && (
            <span className="tnum flex items-center gap-1">
              <MessageSquare className="size-3" />
              {task.comment_count}
            </span>
          )}
          {task.attachment_count > 0 && (
            <span className="tnum flex items-center gap-1">
              <Paperclip className="size-3" />
              {task.attachment_count}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
