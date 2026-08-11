"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
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
import { Clock3, MessageSquare, Paperclip } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  DueDate,
  PriorityBadge,
  formatMinutes,
} from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

import { useBoard, useMoveTask } from "./board.api";
import type { BoardColumn, TaskCard } from "./board.types";
import { NewTaskButton } from "./new-task-dialog";

export function BoardView({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const { data, isLoading } = useBoard(projectId);
  const moveTask = useMoveTask(projectId);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    // A small activation distance keeps a click on the card from being read as a
    // drag, so opening a task still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Memoized so the identity is stable: a bare `data?.columns ?? []` creates a
  // new array every render and would invalidate the lookup map below each time.
  const columns = useMemo(() => data?.columns ?? [], [data]);

  const taskById = useMemo(() => {
    const map = new Map<string, TaskCard>();
    for (const column of columns) {
      for (const task of column.tasks) map.set(task.id, task);
    }
    return map;
  }, [columns]);

  function columnOf(taskId: string): BoardColumn | undefined {
    return columns.find((column) =>
      column.tasks.some((task) => task.id === taskId),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);
    if (taskId === overId) return;

    // `over` is either a column (dropped on empty space) or another task.
    const targetColumn =
      columns.find((column) => column.id === overId) ?? columnOf(overId);
    if (!targetColumn) return;

    const sourceColumn = columnOf(taskId);

    // Compute the drop's neighbours in the target column, excluding the dragged
    // task itself so a same-column move doesn't measure against its old slot.
    const siblings = targetColumn.tasks.filter((task) => task.id !== taskId);
    const overIndex = siblings.findIndex((task) => task.id === overId);

    const afterTaskId = overIndex === -1 ? null : siblings[overIndex]?.id ?? null;
    const beforeTaskId =
      overIndex === -1
        ? (siblings.at(-1)?.id ?? null)
        : (siblings[overIndex - 1]?.id ?? null);

    if (
      sourceColumn?.id === targetColumn.id &&
      beforeTaskId === null &&
      afterTaskId === null
    ) {
      return;
    }

    moveTask.mutate({
      taskId,
      statusId: targetColumn.id,
      beforeTaskId,
      afterTaskId,
    });
  }

  if (isLoading) {
    return (
      <div className="flex gap-4">
        <Skeleton className="h-96 w-72 shrink-0" />
        <Skeleton className="h-96 w-72 shrink-0" />
        <Skeleton className="h-96 w-72 shrink-0" />
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This project has no board columns.
      </p>
    );
  }

  const dragging = draggingId ? taskById.get(draggingId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      {/* Columns scroll horizontally inside this container; the page body never does. */}
      <div className="board-scroll flex gap-4 pb-4">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            projectId={projectId}
            canEdit={canEdit}
          />
        ))}
      </div>

      <DragOverlay>
        {dragging ? <Card task={dragging} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  column,
  projectId,
  canEdit,
}: {
  column: BoardColumn;
  projectId: string;
  canEdit: boolean;
}) {
  const overLimit =
    column.wip_limit !== null && column.tasks.length > column.wip_limit;

  return (
    <section className="bg-secondary/50 flex w-[19rem] shrink-0 flex-col rounded-xl">
      {/* Sticky so the column name stays visible while a long column scrolls. */}
      <header className="bg-secondary/50 sticky top-0 z-10 flex items-center gap-2 rounded-t-xl px-3 py-3 backdrop-blur">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: column.color ?? "var(--color-n400)" }}
          aria-hidden="true"
        />
        <h2 className="truncate text-sm font-semibold">{column.name}</h2>
        <span
          className={cn(
            "tnum ml-auto rounded-full px-2 py-0.5 text-xs",
            overLimit
              ? "bg-danger-bg text-danger font-semibold"
              : "text-muted-foreground bg-card",
          )}
          title={
            column.wip_limit !== null
              ? `WIP limit ${column.wip_limit}`
              : `${column.tasks.length} task(s)`
          }
        >
          {column.tasks.length}
          {column.wip_limit !== null && ` / ${column.wip_limit}`}
        </span>
      </header>

      <SortableContext
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ColumnDroppable columnId={column.id} isEmpty={column.tasks.length === 0}>
          {column.tasks.map((task) => (
            <SortableCard key={task.id} task={task} disabled={!canEdit} />
          ))}
        </ColumnDroppable>
      </SortableContext>

      {canEdit && (
        <div className="p-2">
          <NewTaskButton projectId={projectId} statusId={column.id} />
        </div>
      )}
    </section>
  );
}

/**
 * The column body is its own drop target so a task can be dropped into an EMPTY
 * column, where there are no sortable cards for the collision detector to hit.
 * `useDroppable`, not `useSortable` — the column is a container, not an item in
 * a sortable list.
 */
function ColumnDroppable({
  columnId,
  isEmpty,
  children,
}: {
  columnId: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { isColumn: true },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-28 flex-1 flex-col gap-2 px-2 pb-2 transition-colors",
        isOver && "bg-accent/8",
      )}
    >
      {children}
      {isEmpty && (
        <p
          className={cn(
            "text-muted-foreground m-1 flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-xs transition-colors",
            isOver && "border-accent text-accent",
          )}
        >
          {isOver ? "Drop here" : "No tasks"}
        </p>
      )}
    </div>
  );
}

function SortableCard({
  task,
  disabled,
}: {
  task: TaskCard;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // The original stays in place but goes translucent while the overlay
      // follows the cursor.
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <Card task={task} />
    </div>
  );
}

function Card({
  task,
  isDragging,
}: {
  task: TaskCard;
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
      <div className="flex items-start gap-2">
        <Link
          href={`/tasks/${task.id}`}
          className="hover:text-accent min-w-0 flex-1 text-sm leading-snug font-medium"
          // Stop the pointer sensor claiming the click meant for the link.
          onPointerDown={(event) => event.stopPropagation()}
        >
          {task.title}
        </Link>
        {task.assignee && (
          <UserAvatar
            user={task.assignee}
            size="xs"
            className="mt-0.5"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PriorityBadge priority={task.priority} />
        <DueDate dueDate={task.due_date} completedAt={task.completed_at} />
        {task.sprint && (
          <Badge variant="outline" className="max-w-28 truncate text-[10px]">
            {task.sprint.name}
          </Badge>
        )}
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
