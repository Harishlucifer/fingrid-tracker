"use client";

import { ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { formatMinutes } from "@/components/task-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar, displayName } from "@/components/user-avatar";
import { currentMonth, shiftMonth } from "@/lib/month";
import { cn } from "@/lib/utils";

import { useProjectOptions, useResourceTimesheet } from "./monthly.api";

const THIS_MONTH = currentMonth();
const TODAY = new Date().toISOString().slice(0, 10);

function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/**
 * Monthly timesheet, one row per person.
 *
 * Admins see every active user — including people who logged nothing, because a
 * zero row is exactly what a utilisation view is for. Everyone else sees only
 * their own row; that is enforced server-side off the session role, so this
 * component never has to be trusted with it.
 */
export function MonthlyTimesheetView({ isAdmin }: { isAdmin: boolean }) {
  const [month, setMonth] = useState(THIS_MONTH);
  const [projectId, setProjectId] = useState("all");

  const { data, isLoading } = useResourceTimesheet(
    month,
    projectId === "all" ? undefined : projectId,
  );
  const { data: projects } = useProjectOptions(isAdmin);

  const isCurrentMonth = month === THIS_MONTH;
  const peopleWithTime =
    data?.rows.filter((row) => row.total_minutes > 0).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next month"
            disabled={isCurrentMonth}
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{monthLabel(month)}</span>
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMonth(THIS_MONTH)}
            >
              This month
            </Button>
          )}
        </div>

        {isAdmin && (
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects?.data.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.key} · {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total logged"
          value={formatMinutes(data?.total_minutes ?? 0)}
          icon={Clock}
        />
        <StatCard
          label={isAdmin ? "People who logged time" : "Days logged"}
          value={
            isAdmin
              ? `${peopleWithTime} / ${data?.rows.length ?? 0}`
              : (data?.rows[0]?.days_logged ?? 0)
          }
          icon={Users}
        />
        <StatCard
          label="Average per person"
          value={formatMinutes(
            peopleWithTime > 0
              ? Math.round((data?.total_minutes ?? 0) / peopleWithTime)
              : 0,
          )}
          hint={peopleWithTime === 0 ? "Nobody logged time" : undefined}
        />
      </div>

      {data && data.truncated_users > 0 && (
        <p className="border-warning/30 bg-warning-bg text-warning rounded-lg border px-3 py-2 text-xs">
          Showing the first {data.rows.length} people; {data.truncated_users} more
          are not listed.
        </p>
      )}

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data || data.rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nobody to show"
              hint="No active users were found for this month."
            />
          ) : (
            /* Wide grid: scrolls inside this box, and the name column is pinned
               so a row stays identifiable at day 28. */
            <div className="scroll-x">
              <table className="w-full text-sm" style={{ minWidth: `${data.days.length * 2.4 + 18}rem` }}>
                <thead>
                  <tr className="border-b">
                    <th className="bg-card sticky left-0 z-10 min-w-52 px-4 py-2.5 text-left text-xs font-medium">
                      <span className="text-muted-foreground">Resource</span>
                    </th>
                    {data.days.map((day) => {
                      const date = new Date(`${day}T12:00:00`);
                      const isWeekend = [0, 6].includes(date.getDay());
                      const isToday = day === TODAY;
                      return (
                        <th
                          key={day}
                          className={cn(
                            "text-muted-foreground w-9 px-0.5 py-2.5 text-center text-[10px] font-medium",
                            isWeekend && "bg-secondary/50",
                            isToday && "text-accent",
                          )}
                          title={date.toLocaleDateString()}
                        >
                          <span className="block font-normal opacity-70">
                            {date
                              .toLocaleDateString(undefined, { weekday: "narrow" })
                              .charAt(0)}
                          </span>
                          <span className="tnum block">{date.getDate()}</span>
                        </th>
                      );
                    })}
                    <th className="bg-card sticky right-0 z-10 w-20 border-l px-3 py-2.5 text-right text-xs font-medium">
                      <span className="text-muted-foreground">Total</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {data.rows.map((row) => (
                    <tr key={row.user.id} className="hover:bg-secondary/30 group">
                      <td className="bg-card group-hover:bg-secondary/30 sticky left-0 z-10 px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar user={row.user} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                              {displayName(row.user)}
                              {!row.user.is_active && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px]"
                                >
                                  inactive
                                </Badge>
                              )}
                            </p>
                            {row.by_project.length > 0 && (
                              <p className="text-muted-foreground truncate text-[11px]">
                                {row.by_project
                                  .slice(0, 2)
                                  .map(
                                    (project) =>
                                      `${project.key} ${formatMinutes(project.minutes)}`,
                                  )
                                  .join(" · ")}
                                {row.by_project.length > 2 &&
                                  ` +${row.by_project.length - 2}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {data.days.map((day) => {
                        const minutes = row.by_day[day] ?? 0;
                        const isWeekend = [0, 6].includes(
                          new Date(`${day}T12:00:00`).getDay(),
                        );
                        const hours = minutes / 60;
                        return (
                          <td
                            key={day}
                            className={cn(
                              "tnum px-0.5 py-2 text-center text-[11px]",
                              isWeekend && "bg-secondary/50",
                              minutes === 0
                                ? "text-muted-foreground/30"
                                : hours >= 8
                                  ? "text-success font-semibold"
                                  : "font-medium",
                            )}
                            title={
                              minutes > 0
                                ? `${formatMinutes(minutes)} on ${day}`
                                : undefined
                            }
                          >
                            {minutes === 0
                              ? "·"
                              : hours >= 1
                                ? hours.toFixed(hours % 1 === 0 ? 0 : 1)
                                : `${minutes}m`}
                          </td>
                        );
                      })}

                      <td className="bg-card group-hover:bg-secondary/30 tnum sticky right-0 z-10 border-l px-3 py-2 text-right font-semibold">
                        {formatMinutes(row.total_minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-secondary/60 border-t">
                    <td className="bg-secondary/60 sticky left-0 z-10 px-4 py-2.5 text-xs font-semibold">
                      Daily total
                    </td>
                    {data.days.map((day) => {
                      const minutes = data.day_totals[day] ?? 0;
                      return (
                        <td
                          key={day}
                          className="tnum px-0.5 py-2.5 text-center text-[11px] font-semibold"
                        >
                          {minutes === 0
                            ? "·"
                            : Math.round((minutes / 60) * 10) / 10}
                        </td>
                      );
                    })}
                    <td className="bg-secondary/60 tnum sticky right-0 z-10 border-l px-3 py-2.5 text-right text-xs font-bold">
                      {formatMinutes(data.total_minutes)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <p className="text-muted-foreground border-t px-4 py-2.5 text-[11px]">
                Day cells show hours (or minutes under an hour). Full days of 8h
                or more are highlighted; weekends are shaded.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
