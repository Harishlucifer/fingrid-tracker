"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "@/components/stat-card";
import { formatMinutes } from "@/components/task-meta";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, buildQuery } from "@/lib/api-client";

type Reports = {
  summary: {
    total_tasks: number;
    open_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    logged_minutes: number;
    by_status: {
      id: string;
      name: string;
      category: string;
      color: string | null;
      count: number;
    }[];
    by_priority: { priority: string; count: number }[];
  };
  throughput: { week: string; completed: number; estimated_minutes: number }[];
  workload: {
    user: { id: string; name: string | null; email: string };
    open_tasks: number;
    estimated_minutes: number;
  }[];
  burndown: {
    sprint: { id: string; name: string; start_date: string; end_date: string };
    total_minutes: number;
    task_count: number;
    series: {
      date: string;
      /** Null on days that have not happened yet — the line stops at today. */
      remaining_minutes: number | null;
      ideal_minutes: number;
      is_future: boolean;
    }[];
  } | null;
};

type Sprint = { id: string; name: string; status: string };

/**
 * Chart colors resolve to the validated categorical slots in globals.css, so
 * they are correct in both themes and were checked with the palette validator
 * (lightness band, chroma floor, CVD separation, normal-vision floor).
 *
 * Brand navy is deliberately NOT used as a mark colour: it fails the lightness
 * band and reads gray under simulation. `reference` is a neutral, because the
 * ideal burndown line is a baseline rather than a series identity — keeping it
 * neutral means the chart carries one real series, not two competing hues.
 */
const SERIES = {
  primary: "var(--color-chart-1)",
  reference: "var(--chart-reference)",
};

/** Recharts needs concrete values for grid/axis, not Tailwind classes. */
const AXIS = {
  grid: "var(--chart-grid)",
  tick: "var(--chart-axis)",
};

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
  boxShadow: "var(--shadow-raised)",
} as const;

export function ReportsView({ projectId }: { projectId: string }) {
  const [sprintId, setSprintId] = useState<string>("none");

  const { data: sprints } = useQuery({
    queryKey: ["sprints", projectId] as const,
    queryFn: () => api.get<Sprint[]>(`/api/v1/projects/${projectId}/sprints`),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", projectId, sprintId] as const,
    queryFn: () =>
      api.get<Reports>(
        `/api/v1/projects/${projectId}/reports${buildQuery({
          sprint_id: sprintId === "none" ? undefined : sprintId,
        })}`,
      ),
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const { summary, throughput, workload, burndown } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tasks" value={summary.open_tasks} />
        <StatCard label="Completed" value={summary.completed_tasks} />
        <StatCard label="Overdue" value={summary.overdue_tasks} tone="danger" />
        <StatCard
          label="Time logged"
          value={formatMinutes(summary.logged_minutes)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Throughput</CardTitle>
            <CardDescription>Tasks completed per week</CardDescription>
          </CardHeader>
          <CardContent>
            {/* One series, so no legend box — the card title names it. */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={throughput} barCategoryGap="22%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={AXIS.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: AXIS.tick }}
                    tickFormatter={(value: string) => value.slice(5)}
                    stroke={AXIS.grid}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: AXIS.tick }}
                    stroke={AXIS.grid}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--color-secondary)" }}
                  />
                  {/* 4px rounded data-end, anchored to the baseline. */}
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill={SERIES.primary}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workload</CardTitle>
            <CardDescription>Open tasks per member</CardDescription>
          </CardHeader>
          <CardContent>
            {workload.length === 0 ? (
              <p className="text-muted-foreground text-sm">No open work.</p>
            ) : (
              <ul className="space-y-3">
                {workload.map((row) => {
                  const max = Math.max(...workload.map((r) => r.open_tasks), 1);
                  return (
                    <li key={row.user.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">
                          {row.user.name ?? row.user.email}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {row.open_tasks} open ·{" "}
                          {formatMinutes(row.estimated_minutes)}
                        </span>
                      </div>
                      <div className="bg-secondary h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-accent h-full rounded-full"
                          style={{
                            width: `${(row.open_tasks / max) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Sprint burndown</CardTitle>
            <CardDescription>
              Remaining estimated effort against the ideal line
            </CardDescription>
          </div>
          <Select value={sprintId} onValueChange={setSprintId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Choose a sprint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No sprint selected</SelectItem>
              {sprints?.map((sprint) => (
                <SelectItem key={sprint.id} value={sprint.id}>
                  {sprint.name} ({sprint.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {!burndown ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Select a sprint to see its burndown.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground mb-4 text-xs">
                {burndown.task_count} task(s) ·{" "}
                {formatMinutes(burndown.total_minutes)} estimated ·{" "}
                {burndown.sprint.start_date} to {burndown.sprint.end_date}
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndown.series}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={AXIS.grid}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: AXIS.tick }}
                      tickFormatter={(value: string) => value.slice(5)}
                      stroke={AXIS.grid}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: AXIS.tick }}
                      tickFormatter={(value: number) =>
                        value >= 60 ? `${Math.round(value / 60)}h` : `${value}m`
                      }
                      stroke={AXIS.grid}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) =>
                        formatMinutes(typeof value === "number" ? value : 0)
                      }
                    />
                    {/* Two visible lines, so a legend is required — identity is
                        never carried by colour alone. */}
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      iconType="plainline"
                    />
                    {/* Reference first, so the real series draws on top of it. */}
                    <Line
                      type="linear"
                      dataKey="ideal_minutes"
                      name="Ideal"
                      stroke={SERIES.reference}
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="remaining_minutes"
                      name="Remaining"
                      stroke={SERIES.primary}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      // Future days carry no actual data; stop the line rather
                      // than drawing a flat tail to the sprint end.
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

