"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar, displayName } from "@/components/user-avatar";
import { TASK_PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useProject } from "../../projects/board/board.api";
import {
  type Attachment,
  useAttachments,
  useComments,
  useCreateComment,
  useCreateTimeLog,
  useDeleteAttachment,
  useDeleteComment,
  useDeleteTimeLog,
  useTask,
  useTimeLogs,
  useUpdateTask,
  useUploadAttachment,
} from "./detail.api";

export function TaskDetailView({
  taskId,
  canEdit,
  currentUserId,
}: {
  taskId: string;
  canEdit: boolean;
  currentUserId: string;
}) {
  const { data: task, isLoading } = useTask(taskId);

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
          <CommentsCard
            taskId={taskId}
            canEdit={canEdit}
            currentUserId={currentUserId}
          />
        </main>

        <aside className="order-first space-y-5 xl:sticky xl:top-6 xl:order-last">
          <PropertiesCard taskId={taskId} task={task} canEdit={canEdit} />
          <TimeCard
            taskId={taskId}
            canEdit={canEdit}
            currentUserId={currentUserId}
          />
        </aside>
      </div>
    </div>
  );
}

type Task = NonNullable<ReturnType<typeof useTask>["data"]>;

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
  const [previewing, setPreviewing] = useState<Attachment | null>(null);

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
                      onClick={() => setPreviewing(attachment)}
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

      <AttachmentPreviewDialog
        attachment={previewing}
        onClose={() => setPreviewing(null)}
      />
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

function CommentsCard({
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
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const comments = data?.data ?? [];
  const roots = comments.filter((comment) => !comment.parent_id);
  const repliesOf = (parentId: string) =>
    comments.filter((comment) => comment.parent_id === parentId);

  function submit() {
    if (!body.trim()) return;
    createComment.mutate(
      { body, parentId: replyTo },
      {
        onSuccess: () => {
          setBody("");
          setReplyTo(null);
        },
      },
    );
  }

  return (
    <Card size="sm" className="shadow-card">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
          Activity
          {comments.length > 0 ? (
            <span className="bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {comments.length}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                Only project members can be mentioned.
              </p>
              <Button
                size="sm"
                onClick={submit}
                disabled={createComment.isPending || !body.trim()}
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
      </CardContent>
    </Card>
  );
}

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

        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>

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

function TimeCard({
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

  const [minutes, setMinutes] = useState("");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));

  return (
    <Card size="sm" className="shadow-card">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="text-muted-foreground size-4" aria-hidden="true" />
          Time
          {data ? (
            <span className="bg-accent/10 text-accent ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold">
              {formatMinutes(data.total_minutes)}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <div className="bg-secondary/45 space-y-2 rounded-lg p-2.5">
            <div className="grid grid-cols-[5rem_1fr] gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Min"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="h-8 text-xs"
              />
              <Input
                type="date"
                value={spentOn}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setSpentOn(event.target.value)}
                className="h-8 min-w-0 text-xs"
              />
            </div>
            <Button
              size="sm"
              className="h-8 w-full text-xs"
              disabled={createTimeLog.isPending || !minutes}
              onClick={() =>
                createTimeLog.mutate(
                  { minutes: Number(minutes), spentOn },
                  { onSuccess: () => setMinutes("") },
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
          <Skeleton className="h-10 w-full" />
        ) : !data || data.entries.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-xs">
            No time logged.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {data.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <UserAvatar user={entry.user} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {displayName(entry.user)}
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    {formatShortDate(entry.spent_on)}
                  </p>
                </div>
                <span className="tnum text-xs font-semibold">
                  {formatMinutes(entry.minutes)}
                </span>
                {entry.user.id === currentUserId && (
                  <button
                    type="button"
                    className={cn(
                      "text-muted-foreground hover:text-danger shrink-0",
                      deleteTimeLog.isPending && "opacity-50",
                    )}
                    onClick={() => deleteTimeLog.mutate(entry.id)}
                    aria-label="Remove time entry"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
