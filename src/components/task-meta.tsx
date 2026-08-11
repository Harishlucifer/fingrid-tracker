import { AlertTriangle, CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Priority and due-date chips, shared by the board, the list view and the task
 * detail page so the same task never renders three different ways.
 *
 * Priority is a severity ramp, not a categorical palette — low to urgent is
 * ordered, so the colors are ordered too (neutral → blue → amber → red) and
 * always carry the text label. Color alone would be unreadable for a
 * colorblind viewer, which is why the label is not optional.
 */

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "border-priority-low/30 text-priority-low",
  MEDIUM: "border-priority-medium/40 text-priority-medium",
  HIGH: "border-priority-high/40 text-priority-high bg-warning-bg",
  URGENT: "border-priority-urgent/40 text-priority-urgent bg-danger-bg",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.LOW,
        className,
      )}
    >
      <span
        className="size-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {priority}
    </span>
  );
}

/**
 * Due date, flagged when it has passed and the task is still open.
 *
 * Overdue carries an icon as well as the color, so the state survives both
 * colorblindness and a greyscale print.
 */
export function DueDate({
  dueDate,
  completedAt,
  className,
}: {
  dueDate: string | Date | null;
  completedAt?: string | Date | null;
  className?: string;
}) {
  if (!dueDate) return null;

  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const overdue = !completedAt && date < new Date();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "text-danger font-medium" : "text-muted-foreground",
        className,
      )}
      title={overdue ? "Overdue" : "Due date"}
    >
      {overdue ? (
        <AlertTriangle className="size-3" aria-hidden="true" />
      ) : (
        <CalendarDays className="size-3" aria-hidden="true" />
      )}
      {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
      {overdue && <span className="sr-only">(overdue)</span>}
    </span>
  );
}

/** Minutes as a compact human duration: 90 -> "1h 30m". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Bytes as a compact size: 2048 -> "2.0 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
