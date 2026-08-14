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
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <span className="bg-secondary text-accent ring-border mb-4 flex size-14 items-center justify-center rounded-2xl shadow-sm ring-1">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="font-medium">{title}</p>
      {hint && (
        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
          {hint}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
