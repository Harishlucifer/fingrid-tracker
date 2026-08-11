import Link from "next/link";

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
        "h-full shadow-card transition-all",
        href && "hover:border-accent/40 hover:shadow-raised",
        isAlert && "border-danger/30",
      )}
    >
      <CardContent className="flex items-start gap-3 p-4 sm:p-5">
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              isAlert
                ? "bg-danger-bg text-danger"
                : tone === "success"
                  ? "bg-success-bg text-success"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            <Icon className="size-4.5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p
            className={cn(
              "tnum mt-0.5 text-2xl leading-none font-semibold",
              isAlert && "text-danger",
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return body;

  return (
    <Link href={href} className="rounded-xl focus-visible:outline-none">
      {body}
    </Link>
  );
}
