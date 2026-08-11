"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery, type Paged } from "@/lib/api-client";

import type { Member, UpdateMemberInput } from "./members.types";

const URL_MEMBERS = "/api/v1/admin/users";

export function useMembers(search: string, page = 1) {
  return useQuery({
    queryKey: ["members", search, page] as const,
    queryFn: () =>
      api.getPaged<Member[]>(
        `${URL_MEMBERS}${buildQuery({ q: search, page, per_page: 50 })}`,
      ),
    placeholderData: (previous: Paged<Member[]> | undefined) => previous,
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, ...input }: UpdateMemberInput & { userId: string }) =>
      api.patch<{
        email: string;
        role: string;
        is_active: boolean;
        revoked_sessions: number;
      }>(`${URL_MEMBERS}/${userId}`, input),
    onSuccess: (result) => {
      const revoked =
        result.revoked_sessions > 0
          ? ` ${result.revoked_sessions} session(s) revoked.`
          : "";
      toast.success(
        `${result.email} is now ${result.is_active ? result.role : "deactivated"}.${revoked}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
