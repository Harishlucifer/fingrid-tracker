"use client";

import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  History,
  Inbox,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  PlayCircle,
  Send,
  SignpostBig,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useRef, useState } from "react";

import { DueDate, PriorityBadge, TypeBadge } from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar, displayName } from "@/components/user-avatar";
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  type TaskStage,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useProject } from "../../projects/board/board.api";
import { useSetTaskStage } from "../../projects/backlog/backlog.api";
import {
  type Attachment,
  type TaskActivityEntry,
  useAttachments,
  useComments,
  useCreateComment,
  useCreateTimeLog,
  useDeleteAttachment,
  useDeleteComment,
  useDeleteTimeLog,
  useTask,
  useTaskActivity,
  useTimeLogs,
  useUpdateTask,
  useUpdateTimeLog,
  useUploadAttachment,
} from "./detail.api";

/**
 * Opens the preview dialog for one file.
 *
 * A context rather than a prop, because files now appear in two places that are
 * nowhere near each other in the tree — the Files panel and inside individual
 * comments — and both should open the same single dialog. Threading a callback
 * down through the comment list to do it would be the same wiring, spelled out
 * at every level in between.
 */
const PreviewContext = createContext<(attachment: Attachment) => void>(
  () => undefined,
);

export function TaskDetailView({
  taskId,
  canEdit,
  canManage,
  currentUserId,
}: {
  taskId: string;
  canEdit: boolean;
  canManage: boolean;
  currentUserId: string;
}) {
  const { data: task, isLoading } = useTask(taskId);
  const [previewing, setPreviewing] = useState<Attachment | null>(null);

  if (isLoading || !task) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-4 w-56" />
        <div className="space-y-3 border-b pb-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-3/5" />
          <Skeleton className="h-6 w-96 max-w-full" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-[30rem] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <PreviewContext.Provider value={setPreviewing}>
      <div className="mx-auto max-w-6xl space-y-5">
        <nav aria-label="Breadcrumb">
          <Link
            href={`/projects/${task.project.id}/board`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {task.project.name} board
          </Link>
        </nav>

        <header className="space-y-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wide">
              {task.ref}
            </span>
            <StatusBadge
              category={task.status.category}
              name={task.status.name}
            />
            <StageBadge stage={task.stage} />
            <TypeBadge type={task.type} />
            <PriorityBadge priority={task.priority} />
          </div>

          <TaskTitle taskId={taskId} task={task} canEdit={canEdit} />

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5">
              {task.assignee ? (
                <UserAvatar user={task.assignee} size="xs" />
              ) : (
                <span className="bg-secondary flex size-6 items-center justify-center rounded-full">
                  <UserRound className="size-3" aria-hidden="true" />
                </span>
              )}
              <span className="text-foreground font-medium">
                {task.assignee ? displayName(task.assignee) : "Unassigned"}
              </span>
            </span>
            <DueDate dueDate={task.due_date} completedAt={task.completed_at} />
            {task.estimate_minutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {formatMinutes(task.estimate_minutes)} estimated
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {task.comment_count} comments
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Paperclip className="size-3.5" aria-hidden="true" />
              {task.attachment_count} files
            </span>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="min-w-0 space-y-5">
            <DescriptionCard taskId={taskId} task={task} canEdit={canEdit} />
            <AttachmentsCard
              taskId={taskId}
              canEdit={canEdit}
              currentUserId={currentUserId}
            />
            <TaskTabsCard
              taskId={taskId}
              canEdit={canEdit}
              currentUserId={currentUserId}
            />
          </main>

          <aside className="order-first space-y-5 xl:sticky xl:top-6 xl:order-last">
            <StageCard
              taskId={taskId}
              task={task}
              canEdit={canEdit}
              canManage={canManage}
            />
            <PropertiesCard taskId={taskId} task={task} canEdit={canEdit} />
          </aside>
        </div>

        <AttachmentPreviewDialog
          attachment={previewing}
          onClose={() => setPreviewing(null)}
        />
      </div>
    </PreviewContext.Provider>
  );
}

type Task = NonNullable<ReturnType<typeof useTask>["data"]>;

/**
 * Where the task sits relative to the board.
 *
 * Only shown when it is somewhere other than on it: a badge reading "On the
 * board" beside a task you are looking at on the board is noise, whereas
 * "Backlog" and "Blocked" are exactly what a reader needs to know before they
 * wonder why they cannot find the card.
 */
function StageBadge({ stage }: { stage: TaskStage }) {
  if (stage === "ACTIVE") return null;

  const label =
    stage === "BACKLOG"
      ? "Backlog"
      : stage === "COMPLETED"
        ? "Completed"
        : "Blocked";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        stage === "COMPLETED"
          ? "border-success/25 bg-success-bg text-success"
          : stage === "BLOCKED"
            ? "border-danger/25 bg-danger/10 text-danger"
            : "border-border bg-secondary text-muted-foreground",
      )}
    >
      {stage === "COMPLETED" ? (
        <CheckCircle2 className="size-3" aria-hidden="true" />
      ) : stage === "BLOCKED" ? (
        <Ban className="size-3" aria-hidden="true" />
      ) : (
        <Inbox className="size-3" aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}

/**
 * The gates at either end of the board.
 *
 * Two different acts sit in one card because they are the same question asked at
 * different moments — "should this be on the board?" — but they answer to
 * different permissions, and the card only offers what the viewer can actually
 * do. Sign-off additionally needs the task to be in a Done column; the server
 * refuses otherwise, so rather than show a button that will fail, the card says
 * why it is not there yet.
 */
function StageCard({
  taskId,
  task,
  canEdit,
  canManage,
}: {
  taskId: string;
  task: Task;
  canEdit: boolean;
  canManage: boolean;
}) {
  // Keyed by project, because that is what the hook invalidates — the board and
  // the backlog this task just left or joined.
  const setStage = useSetTaskStage(task.project.id);
  const [reason, setReason] = useState("");

  const inDone = task.status.category === "DONE";
  const stage = task.stage;

  // A VIEWER gets the badge in the header and nothing else to press.
  if (!canEdit) return null;

  function move(next: TaskStage) {
    setStage.mutate(
      { taskId, stage: next, reason: reason.trim() || undefined },
      { onSuccess: () => setReason("") },
    );
  }

  return (
    <Card size="sm" className="shadow-card">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <SignpostBig
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
          Stage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs leading-relaxed">
          {stage === "BACKLOG"
            ? "Filed but not started. It is not on the board until you mark it ready."
            : stage === "ACTIVE"
              ? inDone
                ? "On the board, waiting to be signed off."
                : "On the board."
              : stage === "COMPLETED"
                ? "Signed off and off the board. It still counts in every report."
                : "Blocked and off the board. Reopen it when it can move again."}
        </p>

        {stage === "BACKLOG" && (
          <Button
            size="sm"
            className="w-full"
            disabled={setStage.isPending}
            onClick={() => move("ACTIVE")}
          >
            {setStage.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Mark ready
          </Button>
        )}

        {stage === "ACTIVE" && (
          <div className="space-y-2">
            {canManage && inDone && (
              <>
                <Textarea
                  rows={2}
                  value={reason}
                  maxLength={500}
                  className="resize-y text-xs"
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why? (optional — worth writing when blocking)"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={setStage.isPending}
                    onClick={() => move("COMPLETED")}
                  >
                    <CheckCircle2 className="size-4" />
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={setStage.isPending}
                    onClick={() => move("BLOCKED")}
                  >
                    <Ban className="size-4" />
                    Block
                  </Button>
                </div>
              </>
            )}

            {canManage && !inDone && (
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
                Move this task to a Done column to sign it off.
              </p>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground w-full"
              disabled={setStage.isPending}
              onClick={() => move("BACKLOG")}
            >
              <Undo2 className="size-4" />
              Send back to backlog
            </Button>
          </div>
        )}

        {(stage === "COMPLETED" || stage === "BLOCKED") &&
          (canManage ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={setStage.isPending}
                onClick={() => move("ACTIVE")}
              >
                <Undo2 className="size-4" />
                Reopen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                disabled={setStage.isPending}
                onClick={() =>
                  move(stage === "COMPLETED" ? "BLOCKED" : "COMPLETED")
                }
              >
                {stage === "COMPLETED" ? (
                  <Ban className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {stage === "COMPLETED" ? "Block instead" : "Complete instead"}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
              Only a project lead can reopen this.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ category, name }: { category: string; name: string }) {
  const Icon = category === "DONE" ? CheckCircle2 : Clock3;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        category === "DONE"
          ? "border-success/25 bg-success-bg text-success"
          : category !== "TODO"
            ? "border-accent/25 bg-accent/10 text-accent"
            : "border-border bg-secondary text-muted-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {name}
    </Badge>
  );
}

/**
 * The task heading, editable in place.
 *
 * Enter saves and Escape cancels — what a single-line field is expected to do.
 * The description below deliberately uses buttons only, because a textarea needs
 * Enter for newlines.
 *
 * An empty title is refused here as well as by the API: `updateTaskSchema`
 * requires at least one character, so saving one would only produce a 400 after
 * the round trip.
 */
function TaskTitle({
  taskId,
  task,
  canEdit,
}: {
  taskId: string;
  task: Task;
  canEdit: boolean;
}) {
  const updateTask = useUpdateTask(taskId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const trimmed = draft.trim();

  function save() {
    // Nothing worth sending: keep the editor open rather than silently
    // discarding what they typed.
    if (!trimmed) return;
    if (trimmed === task.title) {
      setEditing(false);
      return;
    }
    updateTask.mutate(
      { title: trimmed },
      { onSuccess: () => setEditing(false) },
    );
  }

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <h1 className="max-w-4xl text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          {task.title}
        </h1>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit title"
            className="text-muted-foreground hover:text-foreground -mt-0.5 size-8 shrink-0 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            onClick={() => {
              setDraft(task.title);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={draft}
        maxLength={500}
        aria-label="Task title"
        aria-invalid={!trimmed}
        className="h-auto max-w-4xl py-1.5 text-2xl font-semibold tracking-tight md:text-3xl"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") setEditing(false);
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={!trimmed || updateTask.isPending}
          onClick={save}
        >
          {updateTask.isPending && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={updateTask.isPending}
        >
          Cancel
        </Button>
        {!trimmed && (
          <span className="text-danger text-xs">A title is required.</span>
        )}
      </div>
    </div>
  );
}

function DescriptionCard({
  taskId,
  task,
  canEdit,
}: {
  taskId: string;
  task: Task;
  canEdit: boolean;
}) {
  const updateTask = useUpdateTask(taskId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description ?? "");

  return (
    <Card size="sm" className="shadow-card">
      <CardHeader className="flex-row items-center justify-between border-b">
        <CardTitle className="flex items-center gap-2">
          <FileText
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
          Description
        </CardTitle>
        {canEdit && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setDraft(task.description ?? "");
              setEditing(true);
            }}
          >
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <Textarea
              rows={7}
              value={draft}
              className="resize-y text-sm leading-relaxed"
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={updateTask.isPending}
                onClick={() =>
                  updateTask.mutate(
                    { description: draft || null },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              >
                {updateTask.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={updateTask.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : task.description ? (
          <p className="text-sm leading-6 whitespace-pre-wrap">
            {task.description}
          </p>
        ) : (
          <div className="text-muted-foreground flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm">
            <FileText className="mb-2 size-5 opacity-40" aria-hidden="true" />
            No description added.
            {canEdit && (
              <button
                type="button"
                className="text-accent mt-1 text-xs font-medium hover:underline"
                onClick={() => setEditing(true)}
              >
                Add description
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PropertiesCard({
  taskId,
  task,
  canEdit,
}: {
  taskId: string;
  task: Task;
  canEdit: boolean;
}) {
  const updateTask = useUpdateTask(taskId);
  const { data: project } = useProject(task.project.id);

  return (
    <Card size="sm" className="shadow-card">
      <CardHeader className="border-b">
        <CardTitle>Task details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5">
        <Field label="Status">
          <Select
            value={task.status.id}
            disabled={!canEdit || updateTask.isPending}
            onValueChange={(statusId) => updateTask.mutate({ statusId })}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {project?.statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Type">
          <Select
            value={task.type}
            disabled={!canEdit || updateTask.isPending}
            onValueChange={(type) => updateTask.mutate({ type })}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Priority">
          <Select
            value={task.priority}
            disabled={!canEdit || updateTask.isPending}
            onValueChange={(priority) => updateTask.mutate({ priority })}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Assignee">
          <Select
            value={task.assignee?.id ?? "none"}
            disabled={!canEdit || updateTask.isPending}
            onValueChange={(value) =>
              updateTask.mutate({ assigneeId: value === "none" ? null : value })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {project?.members.map((member) => (
                <SelectItem key={member.user.id} value={member.user.id}>
                  {member.user.name ?? member.user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Due date">
          <Input
            type="date"
            className="h-8 text-xs"
            disabled={!canEdit || updateTask.isPending}
            defaultValue={task.due_date?.slice(0, 10) ?? ""}
            onChange={(event) =>
              updateTask.mutate({ dueDate: event.target.value || null })
            }
          />
        </Field>

        <Field label="Estimate (minutes)">
          <Input
            type="number"
            min={0}
            className="h-8 text-xs"
            disabled={!canEdit || updateTask.isPending}
            defaultValue={task.estimate_minutes ?? ""}
            onBlur={(event) =>
              updateTask.mutate({
                estimateMin: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </Field>

        <div className="text-muted-foreground space-y-2 border-t pt-3 text-[11px]">
          <div className="flex items-center gap-2">
            <UserAvatar user={task.reporter} size="xs" />
            <span className="min-w-0">
              Reported by{" "}
              <span className="text-foreground font-medium">
                {displayName(task.reporter)}
              </span>
            </span>
          </div>
          <p className="pl-8">Created {formatDateTime(task.created_at)}</p>
          {task.completed_at && (
            <p className="text-success flex items-center gap-1.5 pl-8">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Completed {formatDateTime(task.completed_at)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-[11px] font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

function AttachmentsCard({
  taskId,
  canEdit,
  currentUserId,
}: {
  taskId: string;
  canEdit: boolean;
  currentUserId: string;
}) {
  const { data: attachments, isLoading } = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const remove = useDeleteAttachment(taskId);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useContext(PreviewContext);

  return (
    <Card size="sm" className="shadow-card">
      <CardHeader className="flex-row items-center justify-between border-b">
        <CardTitle className="flex items-center gap-2">
          <Paperclip
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
          Attachments
          {attachments?.length ? (
            <span className="bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {attachments.length}
            </span>
          ) : null}
        </CardTitle>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                // Reset so re-picking the same file fires change again.
                event.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !attachments || attachments.length === 0 ? (
          <div className="text-muted-foreground flex min-h-16 items-center justify-center rounded-lg border border-dashed text-sm">
            No files attached.
          </div>
        ) : (
          <ul className="space-y-2">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="bg-secondary/45 flex items-center gap-3 rounded-lg px-3 py-2.5"
              >
                <span className="bg-card text-muted-foreground ring-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-md ring-1">
                  <FileText className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  {/* Both routes authorize per user; neither is a public URL.
                      A file with no preview_url is one we refuse to render
                      inline, so it stays a plain download. */}
                  {attachment.preview_url ? (
                    <button
                      type="button"
                      onClick={() => preview(attachment)}
                      className="hover:text-accent block max-w-full truncate text-left text-sm font-medium"
                    >
                      {attachment.file_name}
                    </button>
                  ) : (
                    <a
                      href={attachment.download_url}
                      className="hover:text-accent block max-w-full truncate text-sm font-medium"
                    >
                      {attachment.file_name}
                    </a>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {formatBytes(attachment.size_bytes)} ·{" "}
                    {displayName(attachment.uploader)}
                  </p>
                </div>
                {attachment.preview_url && (
                  <a
                    href={attachment.download_url}
                    className="text-muted-foreground hover:text-foreground shrink-0 p-2"
                    aria-label={`Download ${attachment.file_name}`}
                  >
                    <Download className="size-4" />
                  </a>
                )}
                {(attachment.uploader.id === currentUserId || canEdit) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-danger size-8"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(attachment.id)}
                    aria-label={`Remove ${attachment.file_name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline preview of one attachment.
 *
 * Images render directly; PDFs and text render in an iframe, which is also what
 * confines them — the preview route sends `Content-Security-Policy: sandbox`, so
 * the frame is an opaque origin that cannot reach this page or its session. The
 * dialog always offers Download too, because a preview is not a substitute for
 * having the file.
 */
function AttachmentPreviewDialog({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(attachment)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="w-[95vw] sm:max-w-5xl">
        {attachment && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">
                {attachment.file_name}
              </DialogTitle>
              <DialogDescription>
                {formatBytes(attachment.size_bytes)} · {attachment.mime_type}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-secondary/40 flex max-h-[75vh] min-h-48 items-center justify-center overflow-auto rounded-lg">
              {attachment.preview_kind === "image" ? (
                /* next/image cannot be used here: the source is a per-user
                   authorized API route behind a session cookie, not a static
                   asset the optimizer can fetch and cache. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.preview_url ?? ""}
                  alt={attachment.file_name}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              ) : (
                <iframe
                  src={attachment.preview_url ?? ""}
                  title={attachment.file_name}
                  className="h-[75vh] w-full rounded-lg bg-white"
                />
              )}
            </div>

            <DialogFooter>
              <a
                href={attachment.download_url}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
              >
                <Download className="size-4" />
                Download
              </a>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Comments, history and time behind one tab bar.
 *
 * These are three answers to three different questions about the same task, and
 * a reader is only ever asking one of them. Stacked as separate cards, whichever
 * one they wanted was below the two they did not; as tabs the choice is theirs,
 * and the counts stay visible either way.
 *
 * Comments and time are fetched here because their totals are on the tab
 * triggers. History deliberately is not: nothing outside its own tab needs it,
 * and Radix unmounts the inactive panels, so it is not requested until someone
 * asks for it.
 */
function TaskTabsCard({
  taskId,
  canEdit,
  currentUserId,
}: {
  taskId: string;
  canEdit: boolean;
  currentUserId: string;
}) {
  const { data: comments } = useComments(taskId);
  const { data: time } = useTimeLogs(taskId);

  const commentCount = comments?.data.length ?? 0;
  const loggedMinutes = time?.total_minutes ?? 0;

  return (
    <Card size="sm" className="shadow-card">
      <Tabs defaultValue="comments" className="gap-0">
        <CardHeader className="border-b">
          <TabsList>
            <TabsTrigger value="comments">
              <MessageSquare aria-hidden="true" />
              Comments
              {commentCount > 0 && <TabCount>{commentCount}</TabCount>}
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History aria-hidden="true" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="time">
              <Clock3 aria-hidden="true" />
              Time log
              {loggedMinutes > 0 && (
                <TabCount>{formatMinutes(loggedMinutes)}</TabCount>
              )}
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="pt-(--card-spacing)">
          <TabsContent value="comments">
            <CommentsTab
              taskId={taskId}
              canEdit={canEdit}
              currentUserId={currentUserId}
            />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab taskId={taskId} />
          </TabsContent>
          <TabsContent value="time">
            <TimeLogTab
              taskId={taskId}
              canEdit={canEdit}
              currentUserId={currentUserId}
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

function TabCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function CommentsTab({
  taskId,
  canEdit,
  currentUserId,
}: {
  taskId: string;
  canEdit: boolean;
  currentUserId: string;
}) {
  const { data, isLoading } = useComments(taskId);
  const createComment = useCreateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const comments = data?.data ?? [];
  const roots = comments.filter((comment) => !comment.parent_id);
  const repliesOf = (parentId: string) =>
    comments.filter((comment) => comment.parent_id === parentId);

  // A file is a comment too: attaching a screenshot with nothing to add is a
  // real thing people do, so an empty body is only empty when nothing came
  // with it. The server applies the same rule.
  const canSubmit = body.trim().length > 0 || files.length > 0;

  function submit() {
    if (!canSubmit) return;
    createComment.mutate(
      { body, parentId: replyTo, files },
      {
        onSuccess: () => {
          setBody("");
          setFiles([]);
          setReplyTo(null);
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : roots.length === 0 ? (
        <div className="text-muted-foreground flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed text-sm">
          <MessageSquare
            className="mb-2 size-5 opacity-40"
            aria-hidden="true"
          />
          No comments yet.
        </div>
      ) : (
        <ul className="space-y-5">
          {roots.map((comment) => (
            <li key={comment.id} className="space-y-3">
              <CommentRow
                comment={comment}
                currentUserId={currentUserId}
                canReply={canEdit}
                onReply={() => setReplyTo(comment.id)}
                onDelete={() => deleteComment.mutate(comment.id)}
              />
              {repliesOf(comment.id).length > 0 && (
                <ul className="border-border ml-3 space-y-3 border-l pl-5">
                  {repliesOf(comment.id).map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        currentUserId={currentUserId}
                        canReply={false}
                        onDelete={() => deleteComment.mutate(reply.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="space-y-2 border-t pt-4">
          {replyTo && (
            <p className="text-muted-foreground text-xs">
              Replying to a comment ·{" "}
              <button
                type="button"
                className="hover:text-foreground underline"
                onClick={() => setReplyTo(null)}
              >
                cancel
              </button>
            </p>
          )}
          <Textarea
            rows={3}
            value={body}
            className="resize-y bg-transparent text-sm"
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a comment. Mention someone with @their.email@example.com"
          />

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="bg-secondary/60 flex max-w-full items-center gap-1.5 rounded-md py-1 pr-1 pl-2 text-xs"
                >
                  <Paperclip
                    className="text-muted-foreground size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-danger shrink-0 rounded p-0.5"
                    aria-label={`Remove ${file.name}`}
                    disabled={createComment.isPending}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, at) => at !== index),
                      )
                    }
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              // MAX_COMMENT_FILES is also enforced by the API; capping here
              // just means the refusal arrives before the upload does.
              setFiles((current) =>
                [...current, ...picked].slice(0, MAX_COMMENT_FILES),
              );
              // Reset so re-picking the same file fires change again.
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={
                  createComment.isPending || files.length >= MAX_COMMENT_FILES
                }
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" />
                Attach
              </Button>
              <p className="text-muted-foreground text-xs">
                {files.length >= MAX_COMMENT_FILES
                  ? `Up to ${MAX_COMMENT_FILES} files per comment.`
                  : "Only project members can be mentioned."}
              </p>
            </div>
            <Button
              size="sm"
              onClick={submit}
              disabled={createComment.isPending || !canSubmit}
            >
              {createComment.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Matches the cap in `createCommentSchema`. */
const MAX_COMMENT_FILES = 10;

function CommentRow({
  comment,
  currentUserId,
  canReply,
  onReply,
  onDelete,
}: {
  comment: {
    id: string;
    body: string;
    created_at: string;
    author: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
    mentions: { id: string; email: string }[];
    attachments: Attachment[];
  };
  currentUserId: string;
  canReply: boolean;
  onReply?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-3">
      <UserAvatar user={comment.author} size="md" />

      <div className="bg-secondary/45 min-w-0 flex-1 rounded-lg px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {comment.author.name ?? comment.author.email}
          </span>
          <span className="text-muted-foreground text-xs">
            {formatDateTime(comment.created_at)}
          </span>
        </div>

        {comment.body.trim().length > 0 && (
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
            {comment.body}
          </p>
        )}

        {comment.attachments.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {comment.attachments.map((attachment) => (
              <li key={attachment.id}>
                <AttachmentChip attachment={attachment} />
              </li>
            ))}
          </ul>
        )}

        {comment.mentions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {comment.mentions.map((mention) => (
              <Badge
                key={mention.id}
                variant="secondary"
                className="text-[10px]"
              >
                @{mention.email}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-2 flex gap-3">
          {canReply && onReply && (
            <button
              type="button"
              onClick={onReply}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Reply
            </button>
          )}
          {comment.author.id === currentUserId && (
            <button
              type="button"
              onClick={onDelete}
              className="text-muted-foreground hover:text-danger text-xs"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One file inside a comment. Compact, because it sits in a paragraph of
 * discussion rather than in a panel of its own — but it opens the same preview
 * dialog and offers the same authorized download as the Files panel does.
 *
 * There is no delete here on purpose: the file belongs to the comment, so it
 * goes when the comment does.
 */
function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const preview = useContext(PreviewContext);

  return (
    <div className="bg-card ring-foreground/10 flex items-center gap-2 rounded-md px-2 py-1.5 ring-1">
      <FileText
        className="text-muted-foreground size-3.5 shrink-0"
        aria-hidden="true"
      />
      {attachment.preview_url ? (
        <button
          type="button"
          onClick={() => preview(attachment)}
          className="hover:text-accent min-w-0 flex-1 truncate text-left text-xs font-medium"
        >
          {attachment.file_name}
        </button>
      ) : (
        <a
          href={attachment.download_url}
          className="hover:text-accent min-w-0 flex-1 truncate text-xs font-medium"
        >
          {attachment.file_name}
        </a>
      )}
      <span className="text-muted-foreground shrink-0 text-[10px]">
        {formatBytes(attachment.size_bytes)}
      </span>
      <a
        href={attachment.download_url}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label={`Download ${attachment.file_name}`}
      >
        <Download className="size-3.5" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

/** What each audit action reads as, in the past tense the reader is scanning for. */
const ACTIVITY_VERBS: Record<string, string> = {
  "task.created": "created this task",
  "task.status_changed": "moved this task",
  "task.assigned": "assigned this task",
  "task.unassigned": "unassigned this task",
  "task.updated": "updated this task",
  "task.stage_changed": "moved this task",
  "task.deleted": "deleted this task",
};

const ACTIVITY_FIELD_LABELS: Record<string, string> = {
  status: "Status",
  stage: "Stage",
  reason: "Reason",
  assignee: "Assignee",
  sprint: "Sprint",
  title: "Title",
  description: "Description",
  type: "Type",
  priority: "Priority",
  due_date: "Due date",
  estimate_minutes: "Estimate",
};

/**
 * The task's own history — every status move and reassignment, and who made it.
 *
 * Comments, files and time entries are not repeated here: each already has the
 * tab beside this one, and mixing them in is what turns "who moved this?" into
 * a scrolling exercise.
 */
function ActivityTab({ taskId }: { taskId: string }) {
  const { data, isLoading } = useTaskActivity(taskId);
  const entries = data?.data ?? [];

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed text-sm">
        <History className="mb-2 size-5 opacity-40" aria-hidden="true" />
        Nothing has happened to this task yet.
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id}>
          <ActivityRow entry={entry} />
        </li>
      ))}
    </ol>
  );
}

function ActivityRow({ entry }: { entry: TaskActivityEntry }) {
  return (
    <div className="flex gap-3">
      <UserAvatar user={entry.actor} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm">
            <span className="font-medium">{displayName(entry.actor)}</span>{" "}
            <span className="text-muted-foreground">
              {ACTIVITY_VERBS[entry.action] ?? entry.action}
            </span>
          </span>
          <span className="text-muted-foreground text-xs">
            {formatDateTime(entry.created_at)}
          </span>
        </div>

        {entry.changes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {entry.changes.map((change) => (
              <li
                key={change.field}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
              >
                <span className="text-muted-foreground w-20 shrink-0">
                  {ACTIVITY_FIELD_LABELS[change.field] ?? change.field}
                </span>
                {/* A board drag records where the task landed but not where it
                    came from, so there is nothing to draw an arrow away from. */}
                {change.from !== null && (
                  <>
                    <span className="text-muted-foreground line-clamp-1 max-w-[16rem] break-all">
                      {displayActivityValue(change.field, change.from)}
                    </span>
                    <ArrowRight
                      className="text-muted-foreground/60 size-3 shrink-0"
                      aria-hidden="true"
                    />
                  </>
                )}
                <span className="line-clamp-1 max-w-[16rem] font-medium break-all">
                  {displayActivityValue(change.field, change.to)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function displayActivityValue(field: string, value: string | null): string {
  if (value === null) return field === "assignee" ? "Unassigned" : "None";
  if (field === "due_date") return formatShortDate(value);
  if (field === "estimate_minutes") return formatMinutes(Number(value));
  return value;
}

// ---------------------------------------------------------------------------
// Time log
// ---------------------------------------------------------------------------

function TimeLogTab({
  taskId,
  canEdit,
  currentUserId,
}: {
  taskId: string;
  canEdit: boolean;
  currentUserId: string;
}) {
  const { data, isLoading } = useTimeLogs(taskId);
  const createTimeLog = useCreateTimeLog(taskId);
  const deleteTimeLog = useDeleteTimeLog(taskId);

  const today = new Date().toISOString().slice(0, 10);
  const [minutes, setMinutes] = useState("");
  const [spentOn, setSpentOn] = useState(today);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="bg-secondary/45 flex flex-wrap items-center gap-2 rounded-lg p-2.5">
          <Input
            type="number"
            min={1}
            placeholder="Minutes"
            value={minutes}
            aria-label="Minutes"
            onChange={(event) => setMinutes(event.target.value)}
            className="h-8 w-24 text-xs"
          />
          <Input
            type="date"
            value={spentOn}
            max={today}
            aria-label="Date worked"
            onChange={(event) => setSpentOn(event.target.value)}
            className="h-8 w-40 text-xs"
          />
          <Input
            placeholder="What did you work on? (optional)"
            value={note}
            maxLength={500}
            aria-label="Note"
            onChange={(event) => setNote(event.target.value)}
            className="h-8 w-full min-w-40 flex-1 text-xs sm:w-auto"
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={createTimeLog.isPending || !minutes}
            onClick={() =>
              createTimeLog.mutate(
                {
                  minutes: Number(minutes),
                  spentOn,
                  ...(note.trim() ? { note: note.trim() } : {}),
                },
                {
                  onSuccess: () => {
                    setMinutes("");
                    setNote("");
                  },
                },
              )
            }
          >
            {createTimeLog.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Log time
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !data || data.entries.length === 0 ? (
        <div className="text-muted-foreground flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed text-sm">
          <Clock3 className="mb-2 size-5 opacity-40" aria-hidden="true" />
          No time logged.
        </div>
      ) : (
        <>
          <ul className="divide-y">
            {data.entries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                taskId={taskId}
                entry={entry}
                // Editing someone else's hours is a delete and a create wearing
                // another name, so only the person who logged it may — which is
                // the rule the API enforces regardless of what is rendered.
                canManage={entry.user.id === currentUserId}
                onDelete={() => deleteTimeLog.mutate(entry.id)}
                deleting={deleteTimeLog.isPending}
              />
            ))}
          </ul>

          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">Total logged</span>
            <span className="tnum font-semibold">
              {formatMinutes(data.total_minutes)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function TimeEntryRow({
  taskId,
  entry,
  canManage,
  onDelete,
  deleting,
}: {
  taskId: string;
  entry: {
    id: string;
    minutes: number;
    spent_on: string;
    note: string | null;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
  canManage: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const updateTimeLog = useUpdateTimeLog(taskId);
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(entry.minutes));
  const [spentOn, setSpentOn] = useState(entry.spent_on);
  const [note, setNote] = useState(entry.note ?? "");

  function startEditing() {
    // Re-seed from the row rather than from stale draft state: the entry may
    // have been refetched since this component last rendered an editor.
    setMinutes(String(entry.minutes));
    setSpentOn(entry.spent_on);
    setNote(entry.note ?? "");
    setEditing(true);
  }

  function save() {
    const parsed = Number(minutes);
    if (!Number.isInteger(parsed) || parsed < 1) return;

    updateTimeLog.mutate(
      {
        timeLogId: entry.id,
        minutes: parsed,
        spentOn,
        note: note.trim() || null,
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  if (editing) {
    return (
      <li className="py-2.5 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            value={minutes}
            aria-label="Minutes"
            className="h-8 w-24 text-xs"
            onChange={(event) => setMinutes(event.target.value)}
          />
          <Input
            type="date"
            value={spentOn}
            max={new Date().toISOString().slice(0, 10)}
            aria-label="Date worked"
            className="h-8 w-40 text-xs"
            onChange={(event) => setSpentOn(event.target.value)}
          />
          <Input
            value={note}
            maxLength={500}
            placeholder="Note (optional)"
            aria-label="Note"
            className="h-8 w-full min-w-40 flex-1 text-xs sm:w-auto"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={updateTimeLog.isPending || !minutes}
            onClick={save}
          >
            {updateTimeLog.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={updateTimeLog.isPending}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <UserAvatar user={entry.user} size="xs" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">
          {displayName(entry.user)}
        </p>
        {entry.note ? (
          <p className="text-muted-foreground truncate text-[11px]">
            {entry.note}
          </p>
        ) : null}
      </div>

      <span className="text-muted-foreground shrink-0 text-[11px]">
        {formatShortDate(entry.spent_on)}
      </span>
      <span className="tnum shrink-0 text-xs font-semibold">
        {formatMinutes(entry.minutes)}
      </span>

      {canManage && (
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-7"
            onClick={startEditing}
            aria-label="Edit time entry"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-danger size-7"
            disabled={deleting}
            onClick={onDelete}
            aria-label="Remove time entry"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}
