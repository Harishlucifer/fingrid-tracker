"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { segment: "board", label: "Board" },
  { segment: "backlog", label: "Backlog" },
  { segment: "list", label: "List" },
  { segment: "sprints", label: "Sprints" },
  { segment: "reports", label: "Reports" },
  { segment: "settings", label: "Settings" },
] as const;

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const href = `/projects/${projectId}/${tab.segment}`;
        const active = pathname === href;

        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
