"use client";

/**
 * TanStack Query hooks for the domain allowlist.
 *
 * Endpoint paths are declared here as module-level consts rather than in a
 * shared registry — the colocation convention from craft-apex, where each
 * `*.api.ts` owns its own URLs and pages never call the client directly.
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery, type Paged } from "@/lib/api-client";

import type {
  AllowedDomain,
  CreateAllowedDomainInput,
  UpdateAllowedDomainInput,
} from "./domains.types";

const URL_ALLOWED_DOMAINS = "/api/v1/admin/allowed-domains";

const domainsKey = (page: number) => ["allowed-domains", page] as const;

export function useAllowedDomains(
  page = 1,
): UseQueryResult<Paged<AllowedDomain[]>> {
  return useQuery({
    queryKey: domainsKey(page),
    // Paging otherwise blanks the list: each page is its own cache key.
    placeholderData: keepPreviousData,
    queryFn: () =>
      api.getPaged<AllowedDomain[]>(
        `${URL_ALLOWED_DOMAINS}${buildQuery({ page, per_page: 50 })}`,
      ),
  });
}

export function useCreateAllowedDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAllowedDomainInput) =>
      api.post<AllowedDomain>(URL_ALLOWED_DOMAINS, input),
    onSuccess: (created) => {
      toast.success(`${created.domain} can now sign in.`);
      void queryClient.invalidateQueries({ queryKey: ["allowed-domains"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateAllowedDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      domainId,
      ...input
    }: UpdateAllowedDomainInput & { domainId: string }) =>
      api.patch<AllowedDomain>(`${URL_ALLOWED_DOMAINS}/${domainId}`, input),
    onSuccess: (updated) => {
      toast.success(
        updated.is_active
          ? `${updated.domain} updated.`
          : `${updated.domain} disabled. Existing sessions on it were revoked.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["allowed-domains"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
