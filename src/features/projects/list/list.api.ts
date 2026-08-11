"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery } from "@/lib/api-client";

import type { CreateProjectInput, ProjectListItem } from "./list.types";

const URL_PROJECTS = "/api/v1/projects";

export function useProjects(page = 1) {
  return useQuery({
    queryKey: ["projects", page] as const,
    queryFn: () =>
      api.getPaged<ProjectListItem[]>(
        `${URL_PROJECTS}${buildQuery({ page, per_page: 50 })}`,
      ),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api.post<{ id: string; key: string; name: string }>(URL_PROJECTS, input),
    onSuccess: (project) => {
      toast.success(`${project.key} created.`);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
