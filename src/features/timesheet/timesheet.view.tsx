"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatMinutes } from "@/components/task-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  useDeleteTimeLog,
  useLogTime,
  useMyOpenTasks,
  useTimesheet,
} from "./timesheet.api";

/** Monday of the week containing `date`, as YYYY-MM-DD. */
function weekStart(date: Date): string {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0); // midday avoids DST edge cases when shifting days
  const offset = (monday.getDay() + 6) % 7; // getDay(): 0 = Sunday
  monday.setDate(monday.getDate() - offset);
  return monday.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * @param embedded set when rendered inside TimesheetTabs, which owns the page
 *        header — otherwise the title would appear twice.
 */
export function TimesheetView({ embedded = false }: { embedded?: boolean } = {}) {
  const [from, setFrom] = useState(() => weekStart(new Date()));
  const to = addDays(from, 6);

  const { data, isLoading } = useTimesheet(from, to);
  const deleteEntry = useDeleteTimeLog(from, to);

  const isCurrentWeek = from === weekStart(new Date());
  const loggedDays = data
    ? Object.values(data.day_totals).filter((minutes) => minutes > 0).length
    : 0;

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-6xl space-y-6"}>
      {!embedded && (
        <PageHeader
          title="Timesheet"
          description="Time you have logged, by task and day."
          actions={<LogTimeDialog from={from} to={to} defaultDate={TODAY} />}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {embedded && (
          <div className="order-last w-full sm:order-none sm:w-auto">
            <LogTimeDialog from={from} to={to} defaultDate={TODAY} />
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFrom(addDays(from, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFrom(addDays(from, 7))}
            aria-label="Next week"
            // Nothing to see beyond the current week; time cannot be logged ahead.
            disabled={isCurrentWeek}
          >
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentWeek && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFrom(weekStart(new Date()))}
            >
              This week
            </Button>
          )}
        </div>

        <p className="text-muted-foreground text-sm">
          {new Date(`${from}T12:00:00`).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
          {" – "}
          {new Date(`${to}T12:00:00`).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total this week"
          value={formatMinutes(data?.total_minutes ?? 0)}
          icon={Clock}
        />
        <StatCard
          label="Days logged"
          value={`${loggedDays} / 7`}
          hint={loggedDays === 0 ? "Nothing logged yet" : undefined}
        />
        <StatCard
          label="Tasks touched"
          value={data?.rows.length ?? 0}
        />
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data || data.rows.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No time logged this week"
              hint="Log time from a task's detail page, or use Log time above to pick a task and enter minutes."
            />
          ) : (
            /* The grid scrolls inside this box; the page body never scrolls sideways. */
            <div className="scroll-x">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground px-4 py-2.5 text-left text-xs font-medium">
                      Task
                    </th>
                    {data.days.map((day) => {
                      const date = new Date(`${day}T12:00:00`);
                      const isToday = day === TODAY;
                      const isWeekend = [0, 6].includes(date.getDay());
                      return (
                        <th
                          key={day}
                          className={cn(
                            "text-muted-foreground w-16 px-1 py-2.5 text-center text-xs font-medium",
                            isWeekend && "bg-secondary/40",
                            isToday && "text-accent",
                          )}
                        >
                          <span className="block">
                            {date.toLocaleDateString(undefined, {
                              weekday: "short",
                            })}
                          </span>
                          <span className="tnum block font-normal">
                            {date.getDate()}
                          </span>
                        </th>
                      );
                    })}
                    <th className="text-muted-foreground w-20 px-3 py-2.5 text-right text-xs font-medium">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {data.rows.map((row) => (
                    <tr key={row.task_id} className="hover:bg-secondary/30">
                      <td className="max-w-xs px-4 py-2.5">
                        <Link
                          href={`/tasks/${row.task_id}`}
                          className="hover:text-accent block truncate font-medium"
                        >
                          {row.title}
                        </Link>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {row.ref}
                        </span>
                      </td>

                      {data.days.map((day) => {
                        const minutes = row.by_day[day] ?? 0;
                        const isWeekend = [0, 6].includes(
                          new Date(`${day}T12:00:00`).getDay(),
                        );
                        return (
                          <td
                            key={day}
                            className={cn(
                              "tnum px-1 py-2.5 text-center",
                              isWeekend && "bg-secondary/40",
                              minutes === 0 && "text-muted-foreground/40",
                            )}
                          >
                            {minutes === 0 ? "·" : formatMinutes(minutes)}
                          </td>
                        );
                      })}

                      <td className="tnum px-3 py-2.5 text-right font-semibold">
                        {formatMinutes(row.total_minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-secondary/50 border-t">
                    <td className="px-4 py-2.5 text-xs font-medium">
                      Daily total
                    </td>
                    {data.days.map((day) => (
                      <td
                        key={day}
                        className="tnum px-1 py-2.5 text-center text-xs font-semibold"
                      >
                        {data.day_totals[day]
                          ? formatMinutes(data.day_totals[day])
                          : "·"}
                      </td>
                    ))}
                    <td className="tnum px-3 py-2.5 text-right text-xs font-bold">
                      {formatMinutes(data.total_minutes)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.entries.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <p className="text-muted-foreground border-b px-4 py-3 text-xs font-medium">
              Individual entries ({data.entries.length})
            </p>
            <ul className="divide-y">
              {data.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="hover:bg-secondary/30 flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="tnum text-muted-foreground w-24 shrink-0 text-xs">
                    {new Date(`${entry.spent_on}T12:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "short", day: "numeric", month: "short" },
                    )}
                  </span>
                  <Link
                    href={`/tasks/${entry.task_id}`}
                    className="hover:text-accent shrink-0 font-mono text-xs"
                  >
                    {entry.ref}
                  </Link>
                  <span className="tnum shrink-0 font-medium">
                    {formatMinutes(entry.minutes)}
                  </span>
                  {entry.note && (
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                      {entry.note}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-danger ml-auto shrink-0 disabled:opacity-50"
                    disabled={deleteEntry.isPending}
                    onClick={() => deleteEntry.mutate(entry.id)}
                    aria-label={`Remove ${formatMinutes(entry.minutes)} on ${entry.spent_on}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LogTimeDialog({
  from,
  to,
  defaultDate,
}: {
  from: string;
  to: string;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [spentOn, setSpentOn] = useState(defaultDate);
  const [note, setNote] = useState("");

  const { data: tasks } = useMyOpenTasks();
  const logTime = useLogTime(from, to);

  const candidates = tasks?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Log time
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!taskId || !minutes) return;
            logTime.mutate(
              {
                taskId,
                minutes: Number(minutes),
                spentOn,
                note: note || undefined,
              },
              {
                onSuccess: () => {
                  setMinutes("");
                  setNote("");
                  setOpen(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Log time</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="ts-task">Task</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger id="ts-task" className="w-full">
                  <SelectValue placeholder="Choose a task" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No open tasks assigned to you
                    </SelectItem>
                  ) : (
                    candidates.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.ref} · {task.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ts-minutes">Minutes</Label>
                <Input
                  id="ts-minutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ts-date">Date</Label>
                <Input
                  id="ts-date"
                  type="date"
                  value={spentOn}
                  // Future work has not happened yet; the API rejects it too.
                  max={defaultDate}
                  onChange={(event) => setSpentOn(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ts-note">Note</Label>
              <Input
                id="ts-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={logTime.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={logTime.isPending || !taskId || !minutes}
            >
              {logTime.isPending && <Loader2 className="size-4 animate-spin" />}
              Log time
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
