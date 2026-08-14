import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single headline number.
 *
 * Per the dataviz form heuristic, one number is a stat tile, not a chart — these
 * replace the three near-identical `Stat` components that had been copy-pasted
 * into the dashboard, my-work and reports pages.
 *
 * Tone is `danger` only when the number represents something needing attention
 * AND is non-zero; a red "0 overdue" is noise, so callers pass tone
 * conditionally and this component keeps the neutral treatment at zero.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  tone?: "default" | "danger" | "success";
}) {
  const isAlert = tone === "danger" && value !== 0 && value !== "0";

  const body = (
    <Card
      className={cn(
        "shadow-card relative h-full rounded-2xl transition-all",
        href &&
          "group-hover:border-accent/40 group-hover:shadow-raised group-hover:-translate-y-0.5",
        isAlert && "border-danger/30",
      )}
    >
      <CardContent className="flex items-start gap-4 p-4 sm:p-5">
        {Icon && (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              isAlert
                ? "bg-danger-bg text-danger"
                : tone === "success"
                  ? "bg-success-bg text-success"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p
            className={cn(
              "tnum mt-1 text-3xl leading-none font-semibold tracking-tight",
              isAlert && "text-danger",
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
          )}
        </div>
        {href && (
          <ArrowUpRight
            className="text-muted-foreground/60 group-hover:text-accent size-4 shrink-0 transition-colors"
            aria-hidden="true"
          />
        )}
      </CardContent>
    </Card>
  );

  if (!href) return body;

  return (
    <Link href={href} className="group block rounded-2xl">
      {body}
    </Link>
  );
}
