"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { PROJECT_ROLES } from "@/lib/constants";

import { projectKey, useProject } from "../board/board.api";
import type { UserRef } from "../list/list.types";

export function ProjectSettingsView({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useProject(projectId);

  const { data: allUsers } = useQuery({
    queryKey: ["assignable-users"] as const,
    queryFn: () => api.get<UserRef[]>("/api/v1/users"),
    enabled: canManage,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: projectKey(projectId) });

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      api.post(`/api/v1/projects/${projectId}/members`, input),
    onSuccess: () => {
      toast.success("Member added.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/api/v1/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      toast.success("Member removed.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>("MEMBER");

  if (isLoading || !project) {
    return <Skeleton className="h-64 w-full" />;
  }

  const memberIds = new Set(project.members.map((member) => member.user.id));
  const candidates = (allUsers ?? []).filter((user) => !memberIds.has(user.id));

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            Project role is intersected with the org role — the narrower one
            wins. Only members can be assigned tasks or @mentioned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Choose someone to add" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Everyone is already a member
                    </SelectItem>
                  ) : (
                    candidates.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name ?? user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_ROLES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                disabled={!userId || userId === "none" || addMember.isPending}
                onClick={() =>
                  addMember.mutate(
                    { userId, role },
                    { onSuccess: () => setUserId("") },
                  )
                }
              >
                {addMember.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Add
              </Button>
            </div>
          )}

          <ul className="divide-y">
            {project.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.user.name ?? member.user.email}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {member.user.email}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {member.role}
                </Badge>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-danger"
                    disabled={removeMember.isPending}
                    onClick={() => removeMember.mutate(member.user.id)}
                    aria-label={`Remove ${member.user.email}`}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Board columns</CardTitle>
          <CardDescription>
            A task entering a DONE-category column is marked complete, which is
            what the burndown and throughput reports measure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {project.statuses.map((status) => (
              <li key={status.id} className="flex items-center gap-3 py-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: status.color ?? "var(--color-n400)" }}
                />
                <span className="flex-1 text-sm">{status.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {status.category}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
