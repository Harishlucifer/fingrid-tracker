"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { SPRINT_STATUSES } from "@/lib/constants";

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  start_date: string;
  end_date: string;
  task_count: number;
  completed_task_count: number;
};

export function SprintsView({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const url = `/api/v1/projects/${projectId}/sprints`;

  const { data: sprints, isLoading } = useQuery({
    queryKey: ["sprints", projectId] as const,
    queryFn: () => api.get<Sprint[]>(url),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });

  const createSprint = useMutation({
    mutationFn: (input: {
      name: string;
      goal?: string;
      startDate: string;
      endDate: string;
    }) => api.post<{ id: string; name: string }>(url, input),
    onSuccess: (sprint) => {
      toast.success(`${sprint.name} created.`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSprint = useMutation({
    mutationFn: ({ sprintId, ...input }: { sprintId: string; status?: string }) =>
      api.patch<{ updated: boolean }>(`${url}/${sprintId}`, input),
    onSuccess: () => {
      toast.success("Sprint updated.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSprint = useMutation({
    mutationFn: (sprintId: string) =>
      api.delete<{ deleted: boolean }>(`${url}/${sprintId}`),
    onSuccess: () => {
      toast.success("Sprint removed. Its tasks were kept and unassigned.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  });

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New sprint</CardTitle>
            <CardDescription>
              Only one sprint can be active at a time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) return;
                createSprint.mutate(
                  {
                    name,
                    goal: goal || undefined,
                    startDate,
                    endDate,
                  },
                  {
                    onSuccess: () => {
                      setName("");
                      setGoal("");
                    },
                  },
                );
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sprint-name">Name</Label>
                  <Input
                    id="sprint-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Sprint 1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sprint-start">Starts</Label>
                  <Input
                    id="sprint-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sprint-end">Ends</Label>
                  <Input
                    id="sprint-end"
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sprint-goal">Goal</Label>
                <Textarea
                  id="sprint-goal"
                  rows={2}
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="Optional"
                />
              </div>

              <Button type="submit" disabled={createSprint.isPending || !name.trim()}>
                {createSprint.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Create sprint
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !sprints || sprints.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-16 text-center text-sm">
            <CalendarRange className="mx-auto mb-3 size-8 opacity-40" />
            No sprints yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sprints.map((sprint) => {
            const percent =
              sprint.task_count === 0
                ? 0
                : Math.round(
                    (sprint.completed_task_count / sprint.task_count) * 100,
                  );

            return (
              <Card key={sprint.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium">{sprint.name}</h2>
                        <Badge
                          variant={sprint.status === "ACTIVE" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {sprint.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {sprint.start_date.slice(0, 10)} →{" "}
                        {sprint.end_date.slice(0, 10)}
                      </p>
                      {sprint.goal && (
                        <p className="mt-2 text-sm">{sprint.goal}</p>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={sprint.status}
                          disabled={updateSprint.isPending}
                          onValueChange={(status) =>
                            updateSprint.mutate({ sprintId: sprint.id, status })
                          }
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SPRINT_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-danger"
                          disabled={deleteSprint.isPending}
                          onClick={() => deleteSprint.mutate(sprint.id)}
                          aria-label={`Remove ${sprint.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>
                        {sprint.completed_task_count} of {sprint.task_count} done
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
