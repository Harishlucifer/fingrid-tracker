"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Info, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Pager } from "@/components/pager";
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

import {
  useAllowedDomains,
  useCreateAllowedDomain,
  useUpdateAllowedDomain,
} from "./domains.api";

/**
 * Zod schema declared inline in the view, per the house form convention
 * (craft-apex has no `.schema.ts` files anywhere).
 *
 * This validates shape only — the authoritative canonicalization runs
 * server-side in `allowed-domain.service.ts`, because a client-side check is a
 * convenience, never a control.
 */
const formSchema = z.object({
  domain: z
    .string()
    .min(3, "Enter a domain such as inforvio.com")
    .refine((value) => value.includes("."), "Must include a dot"),
  autoRole: z.enum(ORG_ROLES),
  note: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function DomainsView() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useAllowedDomains(page);
  const createDomain = useCreateAllowedDomain();
  const updateDomain = useUpdateAllowedDomain();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { domain: "", autoRole: "MEMBER", note: "" },
  });

  // useWatch rather than form.watch(): the latter returns a fresh function each
  // render, which React Compiler cannot memoize and warns about.
  const autoRole = useWatch({ control: form.control, name: "autoRole" });

  const domains = data?.data ?? [];
  const activeCount = domains.filter((domain) => domain.is_active).length;

  function onSubmit(values: FormValues) {
    createDomain.mutate(
      { ...values, note: values.note || undefined },
      { onSuccess: () => form.reset() },
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Allowed email domains
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Anyone with a Google account on an active domain can sign in. Everyone
          else is refused.
        </p>
      </header>

      <div className="border-border bg-secondary/40 text-muted-foreground flex gap-3 rounded-lg border px-4 py-3 text-sm">
        <Info className="text-accent mt-0.5 size-4 shrink-0" />
        <div className="space-y-1 leading-relaxed">
          <p>
            Matching is <strong>exact</strong>. Adding{" "}
            <code className="font-mono text-xs">inforvio.com</code> does not
            admit <code className="font-mono text-xs">mail.inforvio.com</code> —
            add each domain separately.
          </p>
          <p>
            Disabling a domain revokes the active sessions of everyone on it
            immediately, and refuses their next sign-in.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a domain</CardTitle>
          <CardDescription>
            Enter a bare domain — no scheme, port or path.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4 sm:flex-row sm:items-start"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="inforvio.com"
                autoComplete="off"
                spellCheck={false}
                {...form.register("domain")}
              />
              {form.formState.errors.domain && (
                <p className="text-danger text-xs">
                  {form.formState.errors.domain.message}
                </p>
              )}
            </div>

            <div className="w-full space-y-1.5 sm:w-40">
              <Label htmlFor="autoRole">Joins as</Label>
              <Select
                value={autoRole}
                onValueChange={(value) =>
                  form.setValue("autoRole", value as FormValues["autoRole"])
                }
              >
                <SelectTrigger id="autoRole" className="w-full">
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
            </div>

            <Button
              type="submit"
              disabled={createDomain.isPending}
              className="sm:mt-6"
            >
              {createDomain.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add domain
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Domains</CardTitle>
            <CardDescription>
              {activeCount} active of {domains.length}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : domains.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              <Globe className="mx-auto mb-3 size-8 opacity-40" />
              <p>No domains configured.</p>
              <p className="mt-1 text-xs">
                With an empty list nobody can sign in — add one above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Joins as</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {domain.domain}
                        </span>
                        {domain.note && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {domain.note}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {domain.auto_role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-sm">
                        {domain.user_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={domain.is_active}
                          disabled={updateDomain.isPending}
                          aria-label={`${domain.is_active ? "Disable" : "Enable"} ${domain.domain}`}
                          onCheckedChange={(isActive) =>
                            updateDomain.mutate({
                              domainId: domain.id,
                              isActive,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
