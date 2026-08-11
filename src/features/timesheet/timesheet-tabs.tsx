"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

import { MonthlyTimesheetView } from "./monthly.view";
import { TimesheetView } from "./timesheet.view";

type View = "week" | "month";

/**
 * Two timesheets, one page.
 *
 * They answer different questions — "what did I do this week" versus "what did
 * the team log this month" — but users look for both under Timesheet, so they
 * are tabs rather than separate nav entries.
 *
 * Local state rather than a route: switching is instant, each view keeps its own
 * query cache, and there is no URL worth deep-linking to beyond the page itself.
 */
export function TimesheetTabs({ isAdmin }: { isAdmin: boolean }) {
  const [view, setView] = useState<View>("week");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Timesheet"
        description={
          view === "week"
            ? "Time you have logged this week, by task and day."
            : isAdmin
              ? "Time logged by everyone this month, one row per person."
              : "Your logged time for the month."
        }
        actions={
          <div
            role="tablist"
            aria-label="Timesheet view"
            className="bg-secondary inline-flex rounded-lg p-0.5"
          >
            <Tab
              active={view === "week"}
              onClick={() => setView("week")}
              label="My week"
            />
            <Tab
              active={view === "month"}
              onClick={() => setView("month")}
              label={isAdmin ? "Month by resource" : "My month"}
            />
          </div>
        }
      />

      {view === "week" ? (
        <TimesheetView embedded />
      ) : (
        <MonthlyTimesheetView isAdmin={isAdmin} />
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-card"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
