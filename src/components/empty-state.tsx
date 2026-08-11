import { cn } from "@/lib/utils";

/**
 * One empty state, so "nothing here" always looks deliberate rather than broken.
 *
 * `hint` is for the sentence that tells the user what to do next — an empty state
 * without one just reports a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <span className="bg-secondary text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-xs leading-relaxed">
          {hint}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
