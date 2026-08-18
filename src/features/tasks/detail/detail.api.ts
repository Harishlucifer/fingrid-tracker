"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";

import type { TaskCard } from "../../projects/board/board.types";
import type { UserRef } from "../../projects/list/list.types";

const URL_TASKS = "/api/v1/tasks";
const URL_ATTACHMENTS = "/api/v1/attachments";
const URL_COMMENTS = "/api/v1/comments";
const URL_TIME_LOGS = "/api/v1/time-logs";

export type Comment = {
  id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  author: UserRef;
  mentions: { id: string; name: string | null; email: string }[];
  /** Files posted with this comment. Never listed in the Files panel as well. */
  attachments: Attachment[];
};

export type TaskActivityEntry = {
  id: string;
  /** task.created | task.status_changed | task.assigned | task.updated | … */
  action: string;
  created_at: string;
  actor: UserRef;
  /** Already resolved to names by the server — never raw ids. */
  changes: { field: string; from: string | null; to: string | null }[];
};

export type Attachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploader: UserRef;
  download_url: string;
  /** Null when the type must never be rendered inline — an SVG, a .docx. */
  preview_url: string | null;
  preview_kind: "image" | "document" | null;
};

export type TimeLogs = {
  entries: {
    id: string;
    minutes: number;
    spent_on: string;
    note: string | null;
    created_at: string;
    user: UserRef;
  }[];
  total_minutes: number;
};

const taskKey = (taskId: string) => ["task", taskId] as const;
const commentsKey = (taskId: string) => ["task-comments", taskId] as const;
const attachmentsKey = (taskId: string) => ["task-attachments", taskId] as const;
const timeKey = (taskId: string) => ["task-time", taskId] as const;
const activityKey = (taskId: string) => ["task-activity", taskId] as const;

export function useTask(taskId: string) {
  return useQuery({
    queryKey: taskKey(taskId),
    queryFn: () => api.get<TaskCard>(`${URL_TASKS}/${taskId}`),
  });
}

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<TaskCard>(`${URL_TASKS}/${taskId}`, input),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKey(taskId), task);
      // Every list caches its own copy of the card, so an edited title or type
      // would otherwise stay stale on whichever screen the user goes back to.
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ["overall-board"] });
      void queryClient.invalidateQueries({ queryKey: ["task-list"] });
      // The edit that just landed is a history entry too.
      void queryClient.invalidateQueries({ queryKey: activityKey(taskId) });
      toast.success("Task updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// --- comments --------------------------------------------------------------

export function useComments(taskId: string) {
  return useQuery({
    queryKey: commentsKey(taskId),
    queryFn: () =>
      api.getPaged<Comment[]>(`${URL_TASKS}/${taskId}/comments?per_page=100`),
  });
}

/**
 * Post a comment, with any files it carries.
 *
 * Two requests, in this order: the files go up first through the ordinary
 * upload route, then the comment claims them by id. Uploading first is what
 * lets a rejected file — too large, wrong type — fail before anything is
 * posted, instead of leaving a published comment that promises an attachment
 * it never got.
 *
 * The cost of that order is the reverse failure: uploads that succeed followed
 * by a comment that does not, which leaves the files as plain task
 * attachments. That is why the Files panel is refreshed on failure too — the
 * bytes are still there, visible, and the author can delete or re-post them.
 */
export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      body: string;
      parentId?: string | null;
      files?: File[];
    }) => {
      const attachmentIds: string[] = [];

      // Sequential rather than parallel: uploads are the large request here,
      // and a browser tab firing ten multipart POSTs at once is how a slow
      // connection turns one failure into ten.
      for (const file of input.files ?? []) {
        const formData = new FormData();
        formData.append("file", file);
        const uploaded = await api.post<Attachment>(
          `${URL_TASKS}/${taskId}/attachments`,
          formData,
        );
        attachmentIds.push(uploaded.id);
      }

      return api.post<Comment>(`${URL_TASKS}/${taskId}/comments`, {
        body: input.body,
        parentId: input.parentId ?? null,
        attachmentIds,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      // Files may have landed before the comment failed; show them rather than
      // leaving the user with an upload they cannot see or remove.
      void queryClient.invalidateQueries({ queryKey: attachmentsKey(taskId) });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete<{ deleted: boolean }>(`${URL_COMMENTS}/${commentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      // The server removes the comment's own files alongside it.
      void queryClient.invalidateQueries({ queryKey: attachmentsKey(taskId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// --- attachments -----------------------------------------------------------

export function useAttachments(taskId: string) {
  return useQuery({
    queryKey: attachmentsKey(taskId),
    queryFn: () => api.get<Attachment[]>(`${URL_TASKS}/${taskId}/attachments`),
  });
}

export function useUploadAttachment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      // FormData, so the browser sets the multipart boundary itself.
      const formData = new FormData();
      formData.append("file", file);
      return api.post<Attachment>(`${URL_TASKS}/${taskId}/attachments`, formData);
    },
    onSuccess: (attachment) => {
      toast.success(`${attachment.file_name} uploaded.`);
      void queryClient.invalidateQueries({ queryKey: attachmentsKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteAttachment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete<{ deleted: boolean }>(`${URL_ATTACHMENTS}/${attachmentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attachmentsKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// --- time ------------------------------------------------------------------

export function useTimeLogs(taskId: string) {
  return useQuery({
    queryKey: timeKey(taskId),
    queryFn: () => api.get<TimeLogs>(`${URL_TASKS}/${taskId}/time-logs`),
  });
}

export function useCreateTimeLog(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { minutes: number; spentOn: string; note?: string }) =>
      api.post<{ id: string; minutes: number }>(
        `${URL_TASKS}/${taskId}/time-logs`,
        input,
      ),
    onSuccess: () => {
      toast.success("Time logged.");
      void queryClient.invalidateQueries({ queryKey: timeKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["timesheet"] });
      void queryClient.invalidateQueries({ queryKey: ["resource-timesheet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTimeLog(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      timeLogId,
      ...input
    }: {
      timeLogId: string;
      minutes?: number;
      spentOn?: string;
      note?: string | null;
    }) =>
      api.patch<{ id: string; minutes: number; spent_on: string }>(
        `${URL_TIME_LOGS}/${timeLogId}`,
        input,
      ),
    onSuccess: () => {
      toast.success("Time entry updated.");
      void queryClient.invalidateQueries({ queryKey: timeKey(taskId) });
      // Both timesheets read the same rows, and an edited date moves an entry
      // between weeks.
      void queryClient.invalidateQueries({ queryKey: ["timesheet"] });
      void queryClient.invalidateQueries({ queryKey: ["resource-timesheet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTimeLog(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (timeLogId: string) =>
      api.delete<{ deleted: boolean }>(`${URL_TIME_LOGS}/${timeLogId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: timeKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["timesheet"] });
      void queryClient.invalidateQueries({ queryKey: ["resource-timesheet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// --- history ---------------------------------------------------------------

/**
 * What happened to this task: status moves, reassignments, field edits, and who
 * did each of them.
 *
 * Deliberately not the project-wide `/api/v1/activity` feed filtered in the
 * browser — that would page over every event in the project to find the handful
 * belonging to one task.
 */
export function useTaskActivity(taskId: string) {
  return useQuery({
    queryKey: activityKey(taskId),
    queryFn: () =>
      api.getPaged<TaskActivityEntry[]>(
        `${URL_TASKS}/${taskId}/activity?per_page=100`,
      ),
  });
}
