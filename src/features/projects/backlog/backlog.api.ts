"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery } from "@/lib/api-client";
import type { TaskStage } from "@/lib/constants";

import type { TaskCard } from "../board/board.types";

const URL_TASKS = "/api/v1/tasks";
const URL_PROJECTS = "/api/v1/projects";

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

export const backlogKey = (projectId: string, page = 1) =>
  ["backlog", projectId, page] as const;

/**
 * Work that has not been let onto the board yet.
 *
 * `stage=BACKLOG`, not `sprintId=none`. Those used to be the same list by
 * accident — "backlog" meant only "no sprint" — which is why everything anybody
 * filed appeared in To Do immediately whether or not it had been looked at. The
 * backlog is now a stage of its own, and this screen is the gate out of it.
 */
export function useBacklog(projectId: string, page = 1) {
  return useQuery({
    queryKey: backlogKey(projectId, page),
    queryFn: () =>
      api.getPaged<TaskCard[]>(
        `${URL_TASKS}${buildQuery({
          projectId,
          stage: "BACKLOG",
          page,
          per_page: 50,
        })}`,
      ),
    // Paging otherwise blanks the list: each page is its own cache key.
    placeholderData: keepPreviousData,
  });
}

/**
 * Put a task on the board, or take it back off.
 *
 * Invalidates the same broad set as `useAssignSprint` and for the same reason:
 * the task leaves one list and joins another, and a partial update leaves the
 * screen showing it in both.
 */
export function useSetTaskStage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      stage,
      reason,
    }: {
      taskId: string;
      stage: TaskStage;
      reason?: string;
    }) =>
      api.patch<TaskCard>(`${URL_TASKS}/${taskId}/stage`, { stage, reason }),
    onSuccess: (task) => {
      toast.success(
        task.stage === "ACTIVE"
          ? `${task.ref} is ready and on the board.`
          : task.stage === "BACKLOG"
            ? `${task.ref} returned to the backlog.`
            : task.stage === "COMPLETED"
              ? `${task.ref} completed.`
              : `${task.ref} blocked.`,
      );
      // Keyed on the prefix, not backlogKey(projectId, page): a task leaving the
      // backlog changes every page of it, not just the one on screen.
      void queryClient.invalidateQueries({ queryKey: ["backlog", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["sprint-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["overall-board"] });
      void queryClient.invalidateQueries({ queryKey: ["task-list"] });
      void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      void queryClient.invalidateQueries({
        queryKey: ["task-activity", task.id],
      });
    },
    onError: (error: Error) => toast.error(error.message),
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
      // Keyed on the prefix, not backlogKey(projectId, page): a task leaving the
      // backlog changes every page of it, not just the one on screen.
      void queryClient.invalidateQueries({ queryKey: ["backlog", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["sprint-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
