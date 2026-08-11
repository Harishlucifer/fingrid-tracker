"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery } from "@/lib/api-client";

const URL_TIMESHEET = "/api/v1/me/time-logs";
const URL_TIME_LOGS = "/api/v1/time-logs";
const URL_TASKS = "/api/v1/tasks";

export type Timesheet = {
  from: string;
  to: string;
  /** YYYY-MM-DD, one per day in the range. */
  days: string[];
  rows: {
    task_id: string;
    ref: string;
    title: string;
    project: { id: string; key: string };
    by_day: Record<string, number>;
    total_minutes: number;
  }[];
  day_totals: Record<string, number>;
  total_minutes: number;
  entries: {
    id: string;
    minutes: number;
    spent_on: string;
    note: string | null;
    task_id: string;
    ref: string;
  }[];
};

export const timesheetKey = (from: string, to: string) =>
  ["timesheet", from, to] as const;

export function useTimesheet(from: string, to: string) {
  return useQuery({
    queryKey: timesheetKey(from, to),
    queryFn: () =>
      api.get<Timesheet>(`${URL_TIMESHEET}${buildQuery({ from, to })}`),
  });
}

/** Open tasks assigned to me, for the quick-log picker. */
export function useMyOpenTasks() {
  return useQuery({
    queryKey: ["my-open-tasks"] as const,
    queryFn: () =>
      api.getPaged<
        {
          id: string;
          ref: string;
          title: string;
          project: { key: string };
        }[]
      >(`${URL_TASKS}${buildQuery({ open: "true", per_page: 100 })}`),
  });
}

export function useLogTime(from: string, to: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      minutes,
      spentOn,
      note,
    }: {
      taskId: string;
      minutes: number;
      spentOn: string;
      note?: string;
    }) =>
      api.post<{ id: string; minutes: number }>(
        `${URL_TASKS}/${taskId}/time-logs`,
        { minutes, spentOn, note },
      ),
    onSuccess: () => {
      toast.success("Time logged.");
      void queryClient.invalidateQueries({ queryKey: timesheetKey(from, to) });
      void queryClient.invalidateQueries({ queryKey: ["task-time"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTimeLog(from: string, to: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (timeLogId: string) =>
      api.delete<{ deleted: boolean }>(`${URL_TIME_LOGS}/${timeLogId}`),
    onSuccess: () => {
      toast.success("Entry removed.");
      void queryClient.invalidateQueries({ queryKey: timesheetKey(from, to) });
      void queryClient.invalidateQueries({ queryKey: ["task-time"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
