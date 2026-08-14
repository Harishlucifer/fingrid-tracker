"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, FolderKanban, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

import { useCreateProject, useProjects } from "./list.api";

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Projects"
        description={`${data?.meta.total ?? 0} project(s) you can access.`}
        actions={canCreate ? <CreateProjectDialog /> : undefined}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="shadow-card">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const done = project.task_count - project.open_task_count;
            const percent =
              project.task_count === 0
                ? 0
                : Math.round((done / project.task_count) * 100);

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}/board`}
                className="group block rounded-2xl"
              >
                <Card className="shadow-card group-hover:border-accent/40 group-hover:shadow-raised relative h-full rounded-2xl transition-all group-hover:-translate-y-0.5">
                  <span
                    aria-hidden="true"
                    className="from-accent via-chart-1 absolute inset-x-0 top-0 h-1 bg-linear-to-r to-transparent"
                  />
                  <CardContent className="flex h-full flex-col gap-4 p-5 pt-6">
                    <div className="flex items-start gap-3">
                      <span className="bg-accent/10 text-accent flex size-10 shrink-0 items-center justify-center rounded-xl">
                        <FolderKanban className="size-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-muted-foreground font-mono text-[11px] tracking-wide">
                            {project.key}
                          </p>
                          {project.status !== "ACTIVE" && (
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px]"
                            >
                              {project.status}
                            </Badge>
                          )}
                        </div>
                        <h2 className="group-hover:text-accent mt-0.5 truncate font-semibold transition-colors">
                          {project.name}
                        </h2>
                      </div>
                      <ArrowUpRight className="text-muted-foreground/60 group-hover:text-accent size-4 shrink-0 transition-colors" />
                    </div>

                    {project.description && (
                      <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                        {project.description}
                      </p>
                    )}

                    <div className="mt-auto space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground tnum">
                          <strong className="text-foreground">
                            {project.open_task_count}
                          </strong>{" "}
                          open of {project.task_count}
                        </span>
                        <span className="text-muted-foreground tnum">
                          {percent}%
                        </span>
                      </div>

                      {/* Completion bar. Labelled numerically above, so the bar
                          is decoration rather than the only encoding. */}
                      <div
                        className="bg-secondary h-1.5 overflow-hidden rounded-full"
                        aria-hidden="true"
                      >
                        <div
                          className="bg-accent h-full rounded-full transition-[width]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="border-border/70 flex items-center justify-between border-t pt-3">
                        <span className="text-muted-foreground min-w-0 truncate text-[11px]">
                          Owner · {project.owner.name ?? project.owner.email}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {project.my_access}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
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
        <Button>
          <Plus className="size-4" />
          New project
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              The key prefixes every task reference and cannot be changed later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                <p className="text-danger text-xs">
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
                <p className="text-danger text-xs">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Optional"
                {...form.register("description")}
              />
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
