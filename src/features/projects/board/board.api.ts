"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";

import type {
  Board,
  MoveTaskInput,
  ProjectDetail,
  TaskCard,
} from "./board.types";

const URL_PROJECTS = "/api/v1/projects";
const URL_TASKS = "/api/v1/tasks";

export const boardKey = (projectId: string) => ["board", projectId] as const;
export const projectKey = (projectId: string) => ["project", projectId] as const;

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKey(projectId),
    queryFn: () => api.get<ProjectDetail>(`${URL_PROJECTS}/${projectId}`),
  });
}

export function useBoard(projectId: string) {
  return useQuery({
    queryKey: boardKey(projectId),
    queryFn: () => api.get<Board>(`${URL_PROJECTS}/${projectId}/board`),
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      title: string;
      statusId: string;
      type: string;
      priority: string;
      assigneeId?: string | null;
      description?: string;
    }) =>
      // `stage: "ACTIVE"` explicitly: the API files new tasks into the BACKLOG
      // by default so nothing reaches the board unreviewed, but adding a card
      // to a column IS the statement that the work is live, and it would be an
      // odd button that put the card somewhere you cannot see it.
      api.post<TaskCard>(URL_TASKS, { projectId, stage: "ACTIVE", ...input }),
    onSuccess: (task) => {
      toast.success(`${task.ref} created.`);
      void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Move a task, optimistically.
 *
 * The board is rewritten locally before the request goes out so dragging feels
 * instant; on failure the snapshot is restored and the error surfaced. The
 * server is still the authority on `position` — the success path refetches
 * rather than trusting the local guess, because a rebalance may have respaced
 * the entire column.
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, ...body }: MoveTaskInput) =>
      api.patch<TaskCard>(`${URL_TASKS}/${taskId}/move`, body),

    onMutate: async ({ taskId, statusId, beforeTaskId, afterTaskId }) => {
      await queryClient.cancelQueries({ queryKey: boardKey(projectId) });
      const previous = queryClient.getQueryData<Board>(boardKey(projectId));
      if (!previous) return { previous };

      const next: Board = {
        ...previous,
        columns: previous.columns.map((column) => ({
          ...column,
          tasks: [...column.tasks],
        })),
      };

      // Pull the task out of whichever column currently holds it.
      let moved: TaskCard | undefined;
      for (const column of next.columns) {
        const index = column.tasks.findIndex((task) => task.id === taskId);
        if (index !== -1) {
          moved = column.tasks.splice(index, 1)[0];
          break;
        }
      }
      if (!moved) return { previous };

      const target = next.columns.find((column) => column.id === statusId);
      if (!target) return { previous };

      const insertAt = afterTaskId
        ? target.tasks.findIndex((task) => task.id === afterTaskId)
        : beforeTaskId
          ? target.tasks.findIndex((task) => task.id === beforeTaskId) + 1
          : target.tasks.length;

      target.tasks.splice(
        insertAt < 0 ? target.tasks.length : insertAt,
        0,
        { ...moved, status: { ...moved.status, id: target.id, name: target.name } },
      );

      queryClient.setQueryData(boardKey(projectId), next);
      return { previous };
    },

    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKey(projectId), context.previous);
      }
      toast.error(error.message);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
    },
  });
}

/**
 * Sign off every task sitting in the project's Done columns.
 *
 * Invalidates the board and the list, because the cards leave one and appear in
 * the other — the whole point of the act.
 */
export function useSignOffDone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { statusId?: string } = {}) =>
      api.post<{ signed_off: number }>(
        `${URL_PROJECTS}/${projectId}/sign-off`,
        input,
      ),
    onSuccess: ({ signed_off: count }) => {
      toast.success(
        count === 0
          ? "Nothing in Done to sign off."
          : `${count} task${count === 1 ? "" : "s"} signed off.`,
      );
      void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
      void queryClient.invalidateQueries({ queryKey: ["overall-board"] });
      void queryClient.invalidateQueries({ queryKey: ["task-list"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
