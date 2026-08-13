"use client";

import {
  Download,
  Loader2,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <Link href="/projects" className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${task.project.id}/board`}
            className="hover:text-foreground"
          >
            {task.project.name}
          </Link>
          <span>/</span>
          <span className="font-mono">{task.ref}</span>
        </div>
        <TaskTitle taskId={taskId} task={task} canEdit={canEdit} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
        </div>

        <div className="space-y-6">
          <PropertiesCard taskId={taskId} task={task} canEdit={canEdit} />
          <TimeCard taskId={taskId} canEdit={canEdit} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}

type Task = NonNullable<ReturnType<typeof useTask>["data"]>;

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
      <div className="group flex items-start gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit title"
            className="text-muted-foreground hover:text-foreground mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
        className="h-auto py-1.5 text-2xl font-semibold tracking-tight md:text-2xl"
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
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Description</CardTitle>
        {canEdit && !editing && (
          <Button
            variant="ghost"
            size="sm"
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
              rows={8}
              value={draft}
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">No description.</p>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Status">
          <Select
            value={task.status.id}
            disabled={!canEdit || updateTask.isPending}
            onValueChange={(statusId) => updateTask.mutate({ statusId })}
          >
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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

        <div className="text-muted-foreground space-y-1 border-t pt-3 text-xs">
          <p>Reported by {task.reporter.name ?? task.reporter.email}</p>
          <p>Created {new Date(task.created_at).toLocaleString()}</p>
          {task.completed_at && (
            <p className="text-success">
              Completed {new Date(task.completed_at).toLocaleString()}
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
      <Label className="text-muted-foreground text-xs">{label}</Label>
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
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          Attachments {attachments?.length ? `(${attachments.length})` : ""}
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
          <p className="text-muted-foreground text-sm">No files attached.</p>
        ) : (
          <ul className="divide-y">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <Paperclip className="text-muted-foreground size-4 shrink-0" />
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
                    {attachment.uploader.name ?? attachment.uploader.email}
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
                    size="sm"
                    className="text-muted-foreground hover:text-danger"
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
    <Dialog open={Boolean(attachment)} onOpenChange={(open) => !open && onClose()}>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Comments {comments.length > 0 ? `(${comments.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : roots.length === 0 ? (
          <p className="text-muted-foreground text-sm">No comments yet.</p>
        ) : (
          <ul className="space-y-4">
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
                  <ul className="space-y-3 border-l pl-4">
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
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a comment. Mention someone with @their.email@example.com"
            />
            <div className="flex items-center justify-between">
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
    author: { id: string; name: string | null; email: string; image: string | null };
    mentions: { id: string; email: string }[];
  };
  currentUserId: string;
  canReply: boolean;
  onReply?: () => void;
  onDelete: () => void;
}) {
  const initials = (comment.author.name || comment.author.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex gap-3">
      <Avatar className="size-7 shrink-0">
        {comment.author.image ? (
          <AvatarImage src={comment.author.image} alt="" />
        ) : null}
        <AvatarFallback className="text-[10px]">{initials || "?"}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {comment.author.name ?? comment.author.email}
          </span>
          <span className="text-muted-foreground text-xs">
            {new Date(comment.created_at).toLocaleString()}
          </span>
        </div>

        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>

        {comment.mentions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {comment.mentions.map((mention) => (
              <Badge key={mention.id} variant="secondary" className="text-[10px]">
                @{mention.email}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex gap-3">
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
  const [spentOn, setSpentOn] = useState(
    new Date().toISOString().slice(0, 10),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Time logged
          {data ? (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {formatMinutes(data.total_minutes)}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Minutes"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="w-28"
              />
              <Input
                type="date"
                value={spentOn}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setSpentOn(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="w-full"
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
          <p className="text-muted-foreground text-sm">No time logged.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
              >
                <span className="font-medium">{formatMinutes(entry.minutes)}</span>
                <span className="text-muted-foreground text-xs">
                  {entry.spent_on}
                </span>
                <span className="text-muted-foreground ml-auto truncate text-xs">
                  {entry.user.name ?? entry.user.email}
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
