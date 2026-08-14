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
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
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
  const { data, isLoading } = useProjects();
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
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="shadow-raised relative overflow-hidden rounded-[2rem] bg-[#012756] p-6 text-white sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(38rem 28rem at 0% 0%, rgb(49 133 255 / 0.5), transparent 60%), radial-gradient(30rem 24rem at 100% 100%, rgb(91 155 255 / 0.26), transparent 65%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(110deg, black, transparent 72%)",
          }}
        />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Project portfolio
            </div>
            <h1 className="mt-5 max-w-2xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              Turn every project into visible progress.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              Keep priorities, ownership and delivery health together—from the
              first task to the final handoff.
            </p>
            {canCreate && (
              <div className="mt-6">
                <CreateProjectDialog tone="light" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <PortfolioMetric
              icon={FolderKanban}
              label="Active"
              value={isLoading ? null : activeProjects}
            />
            <PortfolioMetric
              icon={ListChecks}
              label="Open work"
              value={isLoading ? null : openTasks}
            />
            <PortfolioMetric
              icon={CheckCircle2}
              label="Complete"
              value={isLoading ? null : `${completionRate}%`}
            />
          </div>
        </div>
      </section>

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

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          <p className="text-muted-foreground text-center text-xs">
            Showing {projects.length} of {data?.meta.total ?? projects.length}{" "}
            projects you can access
          </p>
        </section>
      )}
    </div>
  );
}

function PortfolioMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.09] p-3 backdrop-blur-sm sm:p-4">
      <Icon className="size-4 text-white/55" aria-hidden="true" />
      {value === null ? (
        <div className="mt-3 h-7 w-12 animate-pulse rounded bg-white/15" />
      ) : (
        <p className="tnum mt-3 text-2xl leading-none font-semibold tracking-tight">
          {value}
        </p>
      )}
      <p className="mt-1.5 text-[10px] font-medium tracking-wide text-white/55 uppercase sm:text-[11px]">
        {label}
      </p>
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
      className="group block h-full rounded-2xl"
    >
      <Card className="group-hover:ring-accent/30 group-hover:shadow-raised relative h-full rounded-2xl transition-all group-hover:-translate-y-0.5">
        <span
          aria-hidden="true"
          className="from-accent via-chart-1 absolute inset-x-0 top-0 h-1 bg-linear-to-r to-transparent"
          style={
            projectColor
              ? {
                  background: `linear-gradient(90deg, ${projectColor}, color-mix(in srgb, ${projectColor} 40%, transparent), transparent)`,
                }
              : undefined
          }
        />

        <CardContent className="flex h-full flex-col p-5 pt-6">
          <div className="flex items-start gap-3">
            <span
              className="bg-accent/10 text-accent flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold"
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
              <h3 className="group-hover:text-accent mt-1 truncate text-base font-semibold transition-colors">
                {project.name}
              </h3>
            </div>
            <ArrowUpRight className="text-muted-foreground/50 group-hover:text-accent size-4 shrink-0 transition-colors" />
          </div>

          <p
            className={cn(
              "mt-4 line-clamp-2 min-h-10 text-sm leading-relaxed",
              project.description
                ? "text-muted-foreground"
                : "text-muted-foreground/60 italic",
            )}
          >
            {project.description || "No project description added yet."}
          </p>

          <div className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{formatSchedule(project)}</span>
          </div>

          <div className="bg-secondary/60 mt-4 rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-3 text-xs">
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
              className="bg-card mt-2.5 h-2 overflow-hidden rounded-full shadow-inner"
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

          <div className="border-border/70 mt-4 flex items-center justify-between gap-3 border-t pt-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <UserAvatar user={project.owner} size="xs" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Owner</p>
                <p className="truncate text-xs font-medium">
                  {project.owner.name ?? project.owner.email}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant="outline" className="text-[9px]">
                {formatAccess(project.my_access)}
              </Badge>
              <span className="text-accent flex items-center gap-1 text-xs font-semibold">
                Open board
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </span>
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
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
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

function CreateProjectDialog({
  tone = "default",
}: {
  tone?: "default" | "light";
}) {
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
        <Button
          size="lg"
          className={cn(
            "rounded-xl px-4",
            tone === "light" &&
              "bg-white text-[#012756] shadow-md hover:bg-white/90",
          )}
        >
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
