"use client";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_CATEGORIES, type StatusCategory } from "@/lib/constants";

import type { ProjectColumn, ProjectDetail } from "../board/board.types";
import {
  useCreateColumn,
  useDeleteColumn,
  useReorderColumns,
  useUpdateColumn,
} from "./settings.api";

/** The fields a column edit or create shares. */
type Draft = {
  name: string;
  category: StatusCategory;
  color: string;
  wipLimit: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  category: "TODO",
  color: "#64708a",
  wipLimit: "",
};

function draftOf(column: ProjectColumn): Draft {
  return {
    name: column.name,
    category: column.category,
    color: column.color ?? "#64708a",
    wipLimit: column.wip_limit === null ? "" : String(column.wip_limit),
  };
}

/** Blank clears the limit; anything else is validated as a whole number ≥ 1. */
function parseWipLimit(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function wipLimitError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
    return "Use a whole number from 1 to 999, or leave it blank for no limit.";
  }
  return null;
}

export function ColumnsCard({
  project,
  canManage,
}: {
  project: ProjectDetail;
  canManage: boolean;
}) {
  const columns = project.statuses;

  const createColumn = useCreateColumn(project.id);
  const updateColumn = useUpdateColumn(project.id);
  const reorderColumns = useReorderColumns(project.id);
  const deleteColumn = useDeleteColumn(project.id);

  const [editing, setEditing] = useState<ProjectColumn | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ProjectColumn | null>(null);

  const busy =
    createColumn.isPending ||
    updateColumn.isPending ||
    reorderColumns.isPending ||
    deleteColumn.isPending;

  /** Swap a column with its neighbour and send the whole resulting order. */
  const move = (index: number, delta: number) => {
    const next = [...columns];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorderColumns.mutate(next.map((column) => column.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Board columns</CardTitle>
        <CardDescription>
          A task entering a DONE-category column is marked complete, which is
          what the burndown and throughput reports measure. Re-categorising a
          column that already holds tasks updates them to match.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="divide-y">
          {columns.map((column, index) => (
            <li key={column.id} className="flex items-center gap-3 py-2.5">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: column.color ?? "var(--color-n400)" }}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{column.name}</p>
                <p className="text-muted-foreground text-xs">
                  {column.task_count} task{column.task_count === 1 ? "" : "s"}
                  {column.wip_limit !== null && ` · limit ${column.wip_limit}`}
                </p>
              </div>

              <Badge variant="outline" className="text-[10px]">
                {column.category}
              </Badge>

              {canManage && (
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === 0 || busy}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${column.name} earlier`}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === columns.length - 1 || busy}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${column.name} later`}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setEditing(column)}
                    aria-label={`Edit ${column.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-danger"
                    disabled={busy || columns.length <= 1}
                    title={
                      columns.length <= 1
                        ? "A project must keep at least one column."
                        : undefined
                    }
                    onClick={() => setDeleting(column)}
                    aria-label={`Delete ${column.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" />
            Add column
          </Button>
        )}
      </CardContent>

      <ColumnDialog
        open={creating}
        title="Add column"
        description="New columns are appended to the end of the board. Reorder them afterwards."
        initial={EMPTY_DRAFT}
        pending={createColumn.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(draft) =>
          createColumn.mutate(
            {
              name: draft.name.trim(),
              category: draft.category,
              color: draft.color || null,
              wipLimit: parseWipLimit(draft.wipLimit),
            },
            { onSuccess: () => setCreating(false) },
          )
        }
      />

      <ColumnDialog
        open={editing !== null}
        title={`Edit "${editing?.name ?? ""}"`}
        description="Changing the category to or from DONE re-stamps completion on the tasks already in this column, so the board and the reports stay in agreement."
        initial={editing ? draftOf(editing) : EMPTY_DRAFT}
        pending={updateColumn.isPending}
        onClose={() => setEditing(null)}
        onSubmit={(draft) => {
          if (!editing) return;
          updateColumn.mutate(
            {
              statusId: editing.id,
              input: {
                name: draft.name.trim(),
                category: draft.category,
                color: draft.color || null,
                wipLimit: parseWipLimit(draft.wipLimit),
              },
            },
            { onSuccess: () => setEditing(null) },
          );
        }}
      />

      <DeleteColumnDialog
        column={deleting}
        columns={columns}
        pending={deleteColumn.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={(moveTo) => {
          if (!deleting) return;
          deleteColumn.mutate(
            { statusId: deleting.id, moveTo },
            { onSuccess: () => setDeleting(null) },
          );
        }}
      />
    </Card>
  );
}

function ColumnDialog({
  open,
  title,
  description,
  initial,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  initial: Draft;
  pending: boolean;
  onClose: () => void;
  onSubmit: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);

  // Remount on open so the fields always reflect the column being edited,
  // rather than whatever was last typed into a previous one.
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) setDraft(initial);
  }

  const limitError = wipLimitError(draft.wipLimit);
  const canSubmit = Boolean(draft.name.trim()) && !limitError && !pending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="column-name">Name</Label>
            <Input
              id="column-name"
              value={draft.name}
              maxLength={64}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="column-category">Category</Label>
              <Select
                value={draft.category}
                onValueChange={(value) =>
                  setDraft({ ...draft, category: value as StatusCategory })
                }
              >
                <SelectTrigger id="column-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="column-color">Colour</Label>
              <Input
                id="column-color"
                type="color"
                className="h-9 w-14 p-1"
                value={draft.color || "#64708a"}
                onChange={(event) =>
                  setDraft({ ...draft, color: event.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="column-wip">WIP limit</Label>
            <Input
              id="column-wip"
              inputMode="numeric"
              placeholder="No limit"
              className="w-40"
              value={draft.wipLimit}
              aria-invalid={Boolean(limitError)}
              onChange={(event) =>
                setDraft({ ...draft, wipLimit: event.target.value })
              }
            />
            <p
              className={
                limitError
                  ? "text-danger text-xs"
                  : "text-muted-foreground text-xs"
              }
            >
              {limitError ??
                "Leave blank for no limit. What the limit does is set by the project's WIP policy above."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => onSubmit(draft)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteColumnDialog({
  column,
  columns,
  pending,
  onClose,
  onConfirm,
}: {
  column: ProjectColumn | null;
  columns: ProjectColumn[];
  pending: boolean;
  onClose: () => void;
  onConfirm: (moveTo: string | null) => void;
}) {
  const [moveTo, setMoveTo] = useState("");

  const [seen, setSeen] = useState<string | null>(null);
  if (column?.id !== seen) {
    setSeen(column?.id ?? null);
    setMoveTo("");
  }

  const destinations = columns.filter(
    (candidate) => candidate.id !== column?.id,
  );
  const holdsTasks = (column?.task_count ?? 0) > 0;
  const canConfirm = (!holdsTasks || Boolean(moveTo)) && !pending;

  return (
    <Dialog open={column !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &quot;{column?.name}&quot;</DialogTitle>
          <DialogDescription>
            {holdsTasks
              ? `This column holds ${column?.task_count} task(s). They have to go somewhere — choose a column to move them to.`
              : "This column is empty. Deleting it cannot be undone, but nothing is lost."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="column-move-to">
            Move tasks to{holdsTasks ? "" : " (if any remain)"}
          </Label>
          <Select value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger id="column-move-to" className="w-full">
              <SelectValue placeholder="Choose a column" />
            </SelectTrigger>
            <SelectContent>
              {destinations.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Tasks take the destination&apos;s completion state: moving them into
            a DONE column marks them complete, and out of one reopens them.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => onConfirm(moveTo || null)}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Delete column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
