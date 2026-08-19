"use client";

import { KeyRound, Search, Users } from "lucide-react";
import { useState } from "react";

import { Pager } from "@/components/pager";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ORG_ROLES } from "@/lib/constants";

import { useMembers, useUpdateMember } from "./members.api";

export function MembersView({ currentUserId }: { currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useMembers(search, page);
  const updateMember = useUpdateMember();

  const members = data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everyone who has signed in. Users are created automatically on their
          first Google sign-in from an allowed domain.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {data?.meta.total ?? 0} member(s)
            </CardTitle>
            <CardDescription>
              Deactivating a member revokes their sessions immediately.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                // Back to page one, or narrowing the list while on page five
                // shows an empty table and reads as "no matches".
                setPage(1);
              }}
              placeholder="Search name or email"
              className="pl-8"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              <Users className="mx-auto mb-3 size-8 opacity-40" />
              <p>No members yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="w-36">Role</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const isSelf = member.id === currentUserId;
                    const initials = (member.name || member.email)
                      .split(/[\s@.]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("");

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              {member.image ? (
                                <AvatarImage src={member.image} alt="" />
                              ) : null}
                              <AvatarFallback className="text-xs">
                                {initials || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {member.name ?? "—"}
                                {isSelf && (
                                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="text-muted-foreground truncate font-mono text-xs">
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Select
                            value={member.role}
                            disabled={updateMember.isPending}
                            onValueChange={(role) =>
                              updateMember.mutate({ userId: member.id, role })
                            }
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORG_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell className="text-muted-foreground text-sm">
                          {member.last_login_at
                            ? new Date(member.last_login_at).toLocaleDateString()
                            : "never"}
                        </TableCell>

                        <TableCell className="text-right">
                          {member.active_sessions > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={updateMember.isPending}
                              onClick={() =>
                                updateMember.mutate({
                                  userId: member.id,
                                  revokeSessions: true,
                                })
                              }
                            >
                              <KeyRound className="size-3" />
                              Revoke {member.active_sessions}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <Switch
                            checked={member.is_active}
                            disabled={updateMember.isPending || isSelf}
                            aria-label={`${member.is_active ? "Deactivate" : "Activate"} ${member.email}`}
                            onCheckedChange={(isActive) =>
                              updateMember.mutate({
                                userId: member.id,
                                isActive,
                              })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-muted-foreground mt-3 text-xs">
                You cannot deactivate your own account, and the last active admin
                cannot be demoted or disabled.
              </p>
              {data && (
                <div className="mt-4">
                  <Pager
                    meta={data.meta}
                    disabled={isFetching}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MemberRoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="secondary" className="text-[10px]">
      {role}
    </Badge>
  );
}
