"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITIES } from "@/lib/constants";

import { useCreateTask, useProject } from "./board.api";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: z.string().optional(),
  description: z.string().max(20000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

/** Adds a task straight into one column. */
export function NewTaskButton({
  projectId,
  statusId,
}: {
  projectId: string;
  statusId: string;
}) {
  const [open, setOpen] = useState(false);
  const createTask = useCreateTask(projectId);
  const { data: project } = useProject(projectId);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", priority: "MEDIUM", assigneeId: "", description: "" },
  });

  // useWatch, not form.watch() — see the note in settings/domains.view.tsx.
  const priority = useWatch({ control: form.control, name: "priority" });
  const assigneeId = useWatch({ control: form.control, name: "assigneeId" });

  function onSubmit(values: FormValues) {
    createTask.mutate(
      {
        title: values.title,
        statusId,
        priority: values.priority,
        // "" means unassigned; the API wants null rather than an empty string.
        assigneeId: values.assigneeId || null,
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
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full justify-start"
        >
          <Plus className="size-4" />
          Add task
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" autoFocus {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-danger text-xs">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(value) =>
                    form.setValue("priority", value as FormValues["priority"])
                  }
                >
                  <SelectTrigger id="priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assigneeId">Assignee</Label>
                <Select
                  value={assigneeId || "none"}
                  onValueChange={(value) =>
                    form.setValue("assigneeId", value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id="assigneeId" className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {/* Only project members can be assigned — the API enforces
                        this too, so the list is a convenience, not the control. */}
                    {project?.members.map((member) => (
                      <SelectItem key={member.user.id} value={member.user.id}>
                        {member.user.name ?? member.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} {...form.register("description")} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={createTask.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending && <Loader2 className="size-4 animate-spin" />}
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
