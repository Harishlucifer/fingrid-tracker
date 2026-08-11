"use client";

import { useQuery } from "@tanstack/react-query";

import { api, buildQuery } from "@/lib/api-client";

const URL_RESOURCE_TIMESHEET = "/api/v1/reports/timesheet";
const URL_PROJECTS = "/api/v1/projects";

export type ResourceTimesheet = {
  month: string;
  /** YYYY-MM-DD for every day of the month. */
  days: string[];
  rows: {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      role: string;
      is_active: boolean;
    };
    by_day: Record<string, number>;
    by_project: { id: string; key: string; name: string; minutes: number }[];
    total_minutes: number;
    days_logged: number;
  }[];
  day_totals: Record<string, number>;
  total_minutes: number;
  truncated_users: number;
};

export function useResourceTimesheet(month: string, projectId?: string) {
  return useQuery({
    queryKey: ["resource-timesheet", month, projectId ?? "all"] as const,
    queryFn: () =>
      api.get<ResourceTimesheet>(
        `${URL_RESOURCE_TIMESHEET}${buildQuery({
          month,
          project_id: projectId,
        })}`,
      ),
  });
}

/** Project list for the filter. Admin-only filter, so only fetched for admins. */
export function useProjectOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["project-options"] as const,
    queryFn: () =>
      api.getPaged<{ id: string; key: string; name: string }[]>(
        `${URL_PROJECTS}${buildQuery({ per_page: 100 })}`,
      ),
    enabled,
  });
}
