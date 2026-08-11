"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery } from "@/lib/api-client";

import type { TaskCard } from "../board/board.types";

const URL_TASKS = "/api/v1/tasks";
const URL_PROJECTS = "/api/v1/projects";

/** Sentinel the API understands as "no sprint" — see NO_SPRINT server-side. */
export const NO_SPRINT = "none";

export type SprintSummary = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  start_date: string;
  end_date: string;
  task_count: number;
  completed_task_count: number;
};

export const backlogKey = (projectId: string) => ["backlog", projectId] as const;

/** Tasks in this project with no sprint assigned. */
export function useBacklog(projectId: string) {
  return useQuery({
    queryKey: backlogKey(projectId),
    queryFn: () =>
      api.getPaged<TaskCard[]>(
        `${URL_TASKS}${buildQuery({
          projectId,
          sprintId: NO_SPRINT,
          per_page: 100,
        })}`,
      ),
  });
}

/** Tasks already committed to a given sprint. */
export function useSprintTasks(projectId: string, sprintId: string | null) {
  return useQuery({
    queryKey: ["sprint-tasks", projectId, sprintId] as const,
    queryFn: () =>
      api.getPaged<TaskCard[]>(
        `${URL_TASKS}${buildQuery({
          projectId,
          sprintId: sprintId ?? undefined,
          per_page: 100,
        })}`,
      ),
    enabled: Boolean(sprintId),
  });
}

export function useProjectSprints(projectId: string) {
  return useQuery({
    queryKey: ["sprints", projectId] as const,
    queryFn: () =>
      api.get<SprintSummary[]>(`${URL_PROJECTS}/${projectId}/sprints`),
  });
}

/**
 * Move a task into a sprint, or back to the backlog when `sprintId` is null.
 *
 * Invalidates broadly on purpose: the same task appears in the backlog list, a
 * sprint list, the board and the sprint progress counts, and a partial update
 * would leave one of them stale.
 */
export function useAssignSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      sprintId,
    }: {
      taskId: string;
      sprintId: string | null;
    }) => api.patch<TaskCard>(`${URL_TASKS}/${taskId}`, { sprintId }),
    onSuccess: (task, variables) => {
      toast.success(
        variables.sprintId
          ? `${task.ref} moved into ${task.sprint?.name ?? "the sprint"}.`
          : `${task.ref} returned to the backlog.`,
      );
      void queryClient.invalidateQueries({ queryKey: backlogKey(projectId) });
      void queryClient.invalidateQueries({ queryKey: ["sprint-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
