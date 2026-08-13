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

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: string; parentId?: string | null }) =>
      api.post<Comment>(`${URL_TASKS}/${taskId}/comments`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (error: Error) => toast.error(error.message),
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
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
