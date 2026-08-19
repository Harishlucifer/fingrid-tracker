"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  ListChecks,
  Loader2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Pager } from "@/components/pager";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

import { useCreateProject, useProjects } from "./list.api";
import type { ProjectListItem } from "./list.types";

const formSchema = z.object({
  key: z
    .string()
    .min(2, "At least 2 characters")
    .max(16)
    .regex(
      /^[A-Za-z][A-Za-z0-9]*$/,
      "Letters and digits, starting with a letter",
    ),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(5000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function ProjectsListView({ canCreate }: { canCreate: boolean }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useProjects(page);
  const projects = data?.data ?? [];
  const activeProjects = projects.filter(
    (project) => project.status === "ACTIVE",
  ).length;
  const openTasks = projects.reduce(
    (total, project) => total + project.open_task_count,
    0,
  );
  const allTasks = projects.reduce(
    (total, project) => total + project.task_count,
    0,
  );
  const completedTasks = allTasks - openTasks;
  const completionRate =
    allTasks === 0 ? 0 : Math.round((completedTasks / allTasks) * 100);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Projects"
        description={`${data?.meta.total ?? 0} project(s) you can access.`}
        actions={canCreate ? <CreateProjectDialog /> : undefined}
      />

      <div className="bg-card shadow-card ring-foreground/10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl px-4 py-3 ring-1 sm:px-5">
        <CompactMetric
          icon={FolderKanban}
          label="Active"
          value={isLoading ? null : activeProjects}
        />
        <span
          className="bg-border hidden h-8 w-px sm:block"
          aria-hidden="true"
        />
        <CompactMetric
          icon={ListChecks}
          label="Open work"
          value={isLoading ? null : openTasks}
        />
        <span
          className="bg-border hidden h-8 w-px sm:block"
          aria-hidden="true"
        />
        <CompactMetric
          icon={CheckCircle2}
          label="Complete"
          value={isLoading ? null : `${completionRate}%`}
        />
      </div>

      {isLoading ? (
        <ProjectsLoading />
      ) : projects.length === 0 ? (
        <Card className="shadow-card rounded-3xl border-dashed">
          <CardContent className="p-0">
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              hint={
                canCreate
                  ? "A project gives you a board, a backlog, sprints and reports."
                  : "You are not a member of any project yet. Ask a project lead to add you."
              }
              action={canCreate ? <CreateProjectDialog /> : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <section
          aria-labelledby="project-portfolio-heading"
          className="space-y-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="project-portfolio-heading"
                className="text-xl font-semibold tracking-tight"
              >
                Your projects
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Open a workspace to manage its board, backlog and delivery.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusSummary
                label="Active"
                count={activeProjects}
                className="bg-success-bg text-success"
              />
              <StatusSummary
                label="On hold"
                count={
                  projects.filter((project) => project.status === "ON_HOLD")
                    .length
                }
                className="bg-warning-bg text-warning"
              />
              <StatusSummary
                label="Archived"
                count={
                  projects.filter((project) => project.status === "ARCHIVED")
                    .length
                }
                className="bg-secondary text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          {data && (
            <Pager
              meta={data.meta}
              disabled={isFetching}
              onPageChange={setPage}
            />
          )}
        </section>
      )}
    </div>
  );
}

function CompactMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="flex min-w-24 items-center gap-2.5">
      <span className="bg-accent/10 text-accent flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      {value === null ? (
        <div className="space-y-1">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-3 w-14" />
        </div>
      ) : (
        <div>
          <p className="tnum text-base leading-none font-semibold">{value}</p>
          <p className="text-muted-foreground mt-1 text-[10px] font-medium tracking-wide uppercase">
            {label}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusSummary({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
        className,
      )}
    >
      {label}
      <strong className="tnum font-semibold">{count}</strong>
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-success/25 bg-success-bg text-success",
  ON_HOLD: "border-warning/25 bg-warning-bg text-warning",
  ARCHIVED: "border-border bg-secondary text-muted-foreground",
};

function ProjectCard({ project }: { project: ProjectListItem }) {
  const completed = project.task_count - project.open_task_count;
  const projectColor = safeProjectColor(project.color);
  const completion =
    project.task_count === 0
      ? 0
      : Math.round((completed / project.task_count) * 100);

  return (
    <Link
      href={`/projects/${project.id}/board`}
      className="group block h-full rounded-xl"
    >
      <Card className="group-hover:ring-accent/30 group-hover:shadow-raised relative h-full rounded-xl transition-all group-hover:-translate-y-0.5">
        <span
          aria-hidden="true"
          className="from-accent via-chart-1 absolute inset-x-0 top-0 h-0.5 bg-linear-to-r to-transparent"
          style={
            projectColor
              ? {
                  background: `linear-gradient(90deg, ${projectColor}, color-mix(in srgb, ${projectColor} 40%, transparent), transparent)`,
                }
              : undefined
          }
        />

        <CardContent className="flex h-full flex-col p-4 pt-5">
          <div className="flex items-start gap-2.5">
            <span
              className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold"
              style={
                projectColor
                  ? {
                      backgroundColor: `color-mix(in srgb, ${projectColor} 14%, transparent)`,
                    }
                  : undefined
              }
            >
              {project.key.slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground font-mono text-[11px] tracking-wide">
                  {project.key}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 text-[9px] tracking-wide",
                    STATUS_STYLES[project.status] ?? STATUS_STYLES.ARCHIVED,
                  )}
                >
                  {formatStatus(project.status)}
                </Badge>
              </div>
              <h3 className="group-hover:text-accent mt-0.5 truncate text-sm font-semibold transition-colors">
                {project.name}
              </h3>
            </div>
            <ArrowUpRight className="text-muted-foreground/50 group-hover:text-accent size-4 shrink-0 transition-colors" />
          </div>

          <p
            className={cn(
              "mt-3 line-clamp-1 min-h-5 text-xs leading-relaxed",
              project.description
                ? "text-muted-foreground"
                : "text-muted-foreground/60 italic",
            )}
          >
            {project.description || "No project description added yet."}
          </p>

          <div className="text-muted-foreground mt-2.5 flex items-center gap-1.5 text-[11px]">
            <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{formatSchedule(project)}</span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-muted-foreground">
                <strong className="text-foreground tnum font-semibold">
                  {project.open_task_count}
                </strong>{" "}
                open · <span className="tnum">{completed}</span> completed
              </span>
              <span className="text-foreground tnum font-semibold">
                {completion}%
              </span>
            </div>
            <div
              className="bg-secondary mt-2 h-1.5 overflow-hidden rounded-full"
              aria-label={`${completion}% complete`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <span
                className="from-accent to-chart-1 block h-full rounded-full bg-linear-to-r transition-[width]"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>

          <div className="border-border/70 mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <UserAvatar user={project.owner} size="xs" />
              <p className="truncate text-[11px] font-medium">
                {project.owner.name ?? project.owner.email}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="text-[9px]">
                {formatAccess(project.my_access)}
              </Badge>
              <ArrowUpRight
                className="text-accent size-3.5"
                aria-hidden="true"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ProjectsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-7 w-48 sm:block" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="hidden h-56 rounded-xl 2xl:block" />
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function formatAccess(access: ProjectListItem["my_access"]): string {
  return access === "MANAGE" ? "Manager" : access.toLowerCase();
}

function safeProjectColor(color: string | null): string | null {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatSchedule(project: ProjectListItem): string {
  if (project.start_date && project.end_date) {
    return `${DATE_FORMAT.format(new Date(project.start_date))} – ${DATE_FORMAT.format(new Date(project.end_date))}`;
  }
  if (project.start_date) {
    return `Starts ${DATE_FORMAT.format(new Date(project.start_date))}`;
  }
  if (project.end_date) {
    return `Due ${DATE_FORMAT.format(new Date(project.end_date))}`;
  }
  return "No delivery dates set";
}

function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const createProject = useCreateProject();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { key: "", name: "", description: "" },
  });

  function onSubmit(values: FormValues) {
    createProject.mutate(
      {
        key: values.key.toUpperCase(),
        name: values.name,
        description: values.description || undefined,
      },
      {
        onSuccess: () => {
          form.reset();
          setOpen(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-xl px-4">
          <Plus className="size-4" />
          New project
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <div className="bg-accent/10 text-accent mb-2 flex size-11 items-center justify-center rounded-xl">
              <FolderKanban className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Create a new project</DialogTitle>
            <DialogDescription>
              Set the project identity now. You can configure its workflow,
              members and delivery settings next.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-5">
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  placeholder="PMT"
                  autoComplete="off"
                  className="font-mono uppercase"
                  {...form.register("key")}
                />
                {form.formState.errors.key && (
                  <p role="alert" className="text-danger text-xs">
                    {form.formState.errors.key.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Platform migration"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p role="alert" className="text-danger text-xs">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder="What outcome is this project responsible for?"
                {...form.register("description")}
              />
              <p className="text-muted-foreground text-xs">
                Optional · visible on the project overview.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={createProject.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
