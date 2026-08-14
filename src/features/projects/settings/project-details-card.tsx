"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_STATUSES,
  WIP_POLICIES,
  type WipPolicy,
} from "@/lib/constants";

import type { ProjectDetail } from "../board/board.types";
import { useUpdateProject } from "./settings.api";

/** `<input type="date">` wants YYYY-MM-DD; the API returns an ISO instant. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

const WIP_POLICY_HELP: Record<WipPolicy, string> = {
  DISABLED: "Limits are ignored. Columns show a plain task count.",
  WARN: "The board flags a column that is over its limit, but the move is allowed.",
  ENFORCE: "The server refuses a move that would take a column past its limit.",
};

export function ProjectDetailsCard({
  project,
  canManage,
}: {
  project: ProjectDetail;
  canManage: boolean;
}) {
  const update = useUpdateProject(project.id);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [color, setColor] = useState(project.color ?? "");
  const [startDate, setStartDate] = useState(toDateInput(project.start_date));
  const [endDate, setEndDate] = useState(toDateInput(project.end_date));
  const [wipPolicy, setWipPolicy] = useState<WipPolicy>(project.wip_policy);

  const dirty =
    name !== project.name ||
    description !== (project.description ?? "") ||
    status !== project.status ||
    color !== (project.color ?? "") ||
    startDate !== toDateInput(project.start_date) ||
    endDate !== toDateInput(project.end_date) ||
    wipPolicy !== project.wip_policy;

  // The server checks this too — this only saves a round trip and points at the
  // field rather than the form.
  const datesInverted = Boolean(startDate && endDate && endDate < startDate);

  const save = () => {
    update.mutate({
      name: name.trim(),
      description: description.trim() || null,
      status,
      color: color || null,
      startDate: startDate || null,
      endDate: endDate || null,
      wipPolicy,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project details</CardTitle>
        <CardDescription>
          The key ({project.key}) cannot change — it is baked into every task
          number, and task numbers are permanent.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              maxLength={255}
              disabled={!canManage}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              rows={3}
              maxLength={5000}
              disabled={!canManage}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-status">Lifecycle status</Label>
            <Select
              value={status}
              onValueChange={setStatus}
              disabled={!canManage}
            >
              <SelectTrigger id="project-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-color">Colour</Label>
            <div className="flex items-center gap-2">
              <Input
                id="project-color"
                type="color"
                className="h-9 w-14 p-1"
                value={color || "#3185ff"}
                disabled={!canManage}
                onChange={(event) => setColor(event.target.value)}
              />
              {color && canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColor("")}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-start">Start date</Label>
            <Input
              id="project-start"
              type="date"
              value={startDate}
              disabled={!canManage}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-end">End date</Label>
            <Input
              id="project-end"
              type="date"
              value={endDate}
              disabled={!canManage}
              aria-invalid={datesInverted}
              onChange={(event) => setEndDate(event.target.value)}
            />
            {datesInverted && (
              <p className="text-danger text-xs">
                The end date cannot be before the start date.
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="project-wip">Work-in-progress limits</Label>
            <Select
              value={wipPolicy}
              onValueChange={(value) => setWipPolicy(value as WipPolicy)}
              disabled={!canManage}
            >
              <SelectTrigger id="project-wip" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIP_POLICIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {WIP_POLICY_HELP[wipPolicy]}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex justify-end">
            <Button
              disabled={
                !dirty || !name.trim() || datesInverted || update.isPending
              }
              onClick={save}
            >
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
