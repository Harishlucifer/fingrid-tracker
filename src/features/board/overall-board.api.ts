"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery } from "@/lib/api-client";

import type { TaskCard } from "../projects/board/board.types";
import type { UserRef } from "../projects/list/list.types";

const URL_BOARD = "/api/v1/board";
const URL_TASKS = "/api/v1/tasks";
const URL_USERS = "/api/v1/users";

export type OverallBoard = {
  columns: { category: string; tasks: TaskCard[] }[];
  projects: { id: string; key: string; name: string }[];
  /** Live tasks matching the filters, sent or not. */
  total: number;
  truncated: boolean;
};

export type BoardFilters = {
  projectId?: string;
  assigneeId?: string;
};

export const overallBoardKey = (filters: BoardFilters) =>
  [
    "overall-board",
    filters.projectId ?? "all",
    filters.assigneeId ?? "all",
  ] as const;

export function useOverallBoard(filters: BoardFilters) {
  return useQuery({
    queryKey: overallBoardKey(filters),
    queryFn: () =>
      api.get<OverallBoard>(
        `${URL_BOARD}${buildQuery({
          project_id: filters.projectId,
          assignee_id: filters.assigneeId,
        })}`,
      ),
  });
}

/**
 * Active users, for the assignee filter. Shares the `assignable-users` cache
 * key with the other pickers, so switching screens does not refetch it.
 */
export function useAssignableUsers() {
  return useQuery({
    queryKey: ["assignable-users"] as const,
    queryFn: () => api.get<UserRef[]>(URL_USERS),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Move a task to another category.
 *
 * Optimistic, like the per-project board: the card jumps columns immediately and
 * rolls back on failure. The server resolves which concrete column that means
 * inside the task's own project, so the response is refetched rather than
 * trusted from the local guess.
 */
export function useMoveTaskCategory(filters: BoardFilters) {
  const queryClient = useQueryClient();
  const key = overallBoardKey(filters);

  return useMutation({
    mutationFn: ({ taskId, category }: { taskId: string; category: string }) =>
      api.patch<TaskCard>(`${URL_TASKS}/${taskId}/category`, { category }),

    onMutate: async ({ taskId, category }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<OverallBoard>(key);
      if (!previous) return { previous };

      const next: OverallBoard = {
        ...previous,
        columns: previous.columns.map((column) => ({
          ...column,
          tasks: [...column.tasks],
        })),
      };

      let moved: TaskCard | undefined;
      for (const column of next.columns) {
        const index = column.tasks.findIndex((task) => task.id === taskId);
        if (index !== -1) {
          moved = column.tasks.splice(index, 1)[0];
          break;
        }
      }
      if (!moved) return { previous };

      const target = next.columns.find((column) => column.category === category);
      if (target) {
        target.tasks.unshift(moved);
      }

      queryClient.setQueryData(key, next);
      return { previous };
    },

    onError: (error: Error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error.message);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["overall-board"] });
      // The per-project board caches the same cards.
      void queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}
