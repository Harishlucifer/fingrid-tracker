"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import type { StatusCategory, WipPolicy } from "@/lib/constants";

import { boardKey, projectKey } from "../board/board.api";
import type { ProjectDetail } from "../board/board.types";

const URL_PROJECTS = "/api/v1/projects";

const statusesUrl = (projectId: string) =>
  `${URL_PROJECTS}/${projectId}/statuses`;

export type ProjectDetailsInput = {
  name?: string;
  description?: string | null;
  status?: string;
  color?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  wipPolicy?: WipPolicy;
};

export type ColumnInput = {
  name?: string;
  category?: StatusCategory;
  color?: string | null;
  wipLimit?: number | null;
};

/**
 * Every mutation here invalidates BOTH the project and the board.
 *
 * The settings screen reads the project, but a column change rewrites the board
 * the user will navigate back to — and a category change can re-stamp
 * completion on tasks already sitting in it, so a stale board would show the
 * old columns with the old completion state.
 */
function useProjectMutation<TInput>(
  projectId: string,
  mutationFn: (input: TInput) => Promise<unknown>,
  successMessage: (input: TInput) => string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (_data, input) => {
      toast.success(successMessage(input));
      void queryClient.invalidateQueries({ queryKey: projectKey(projectId) });
      void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProject(projectId: string) {
  return useProjectMutation<ProjectDetailsInput>(
    projectId,
    (input) => api.patch<ProjectDetail>(`${URL_PROJECTS}/${projectId}`, input),
    () => "Project updated.",
  );
}

export function useCreateColumn(projectId: string) {
  return useProjectMutation<
    ColumnInput & { name: string; category: StatusCategory }
  >(
    projectId,
    (input) => api.post<ProjectDetail>(statusesUrl(projectId), input),
    (input) => `Column "${input.name}" added.`,
  );
}

export function useUpdateColumn(projectId: string) {
  return useProjectMutation<{ statusId: string; input: ColumnInput }>(
    projectId,
    ({ statusId, input }) =>
      api.patch<ProjectDetail>(`${statusesUrl(projectId)}/${statusId}`, input),
    () => "Column updated.",
  );
}

/** Sends the complete new order, not a single move — see the route's note. */
export function useReorderColumns(projectId: string) {
  return useProjectMutation<string[]>(
    projectId,
    (order) => api.patch<ProjectDetail>(statusesUrl(projectId), { order }),
    () => "Columns reordered.",
  );
}

export function useDeleteColumn(projectId: string) {
  return useProjectMutation<{ statusId: string; moveTo?: string | null }>(
    projectId,
    ({ statusId, moveTo }) =>
      api.delete<ProjectDetail>(
        `${statusesUrl(projectId)}/${statusId}` +
          (moveTo ? `?move_to=${encodeURIComponent(moveTo)}` : ""),
      ),
    () => "Column removed.",
  );
}
