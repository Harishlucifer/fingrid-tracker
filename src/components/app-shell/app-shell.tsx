"use client";

import {
  BarChart3,
  Clock,
  FolderKanban,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";

import { UserAvatar, displayName } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setSessionExpiredHandler } from "@/lib/api-client";
import { canManageOrgSettings } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/auth/actions";

type ShellUser = {
  name: string;
  email: string;
  image: string | null;
  role: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  // Cross-project board, distinct from a single project's board under /projects.
  { href: "/board", label: "Board", icon: LayoutGrid },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/my-work", label: "My work", icon: ListChecks },
  { href: "/timesheet", label: "Timesheet", icon: Clock },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/settings/domains", label: "Allowed domains", icon: Globe },
  { href: "/settings/members", label: "Members", icon: Users },
];

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = canManageOrgSettings(user.role);
  const sectionTitle = resolveSection(pathname);

  // A 401 from any endpoint means the session died (expired, or revoked by an
  // admin). Bounce through the router so the client cache is dropped.
  useEffect(() => {
    setSessionExpiredHandler(() => router.push("/login"));
  }, [router]);

  return (
    <div className="bg-background flex min-h-full flex-1">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar/95 sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r backdrop-blur lg:flex">
        <Brand />
        <SidebarNav pathname={pathname} isAdmin={isAdmin} />
        <WorkspaceProtection />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/45 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="bg-sidebar shadow-raised absolute inset-y-0 left-0 flex w-72 flex-col border-r">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="hover:bg-secondary text-muted-foreground flex size-8 items-center justify-center rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* Closing on click, not in an effect keyed on pathname — the click
                IS the event, and syncing it through an effect causes a cascading
                render on every navigation. */}
            <SidebarNav
              pathname={pathname}
              isAdmin={isAdmin}
              onNavigate={() => setMobileOpen(false)}
            />
            <WorkspaceProtection />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card/85 sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b px-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="hover:bg-secondary text-muted-foreground flex size-9 items-center justify-center rounded-lg transition-colors lg:hidden"
            >
              <Menu className="size-5" />
            </button>

            <div className="min-w-0">
              <p className="text-muted-foreground hidden text-[10px] font-semibold tracking-[0.14em] uppercase lg:block">
                Current view
              </p>
              <p className="truncate text-sm font-semibold tracking-tight">
                {sectionTitle}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-3 px-4">
      <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-sm">
        PM
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight">
          Inforvio
        </span>
        <span className="text-muted-foreground block truncate text-[11px]">
          Project workspace
        </span>
      </span>
    </div>
  );
}

function SidebarNav({
  pathname,
  isAdmin,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <p className="text-muted-foreground px-3 pb-2 text-[10px] font-semibold tracking-[0.16em] uppercase">
        Workspace
      </p>
      <ul className="space-y-1">
        {MAIN_NAV.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>

      {isAdmin && (
        <>
          <p className="text-muted-foreground px-3 pt-7 pb-2 text-[10px] font-semibold tracking-[0.16em] uppercase">
            Administration
          </p>
          <ul className="space-y-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  exact
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  exact = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const active = exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-[background-color,color,box-shadow]",
        active
          ? "bg-sidebar-active text-sidebar-active-foreground ring-sidebar-active-foreground/5 font-medium shadow-sm ring-1"
          : "text-sidebar-foreground hover:bg-secondary/70 hover:text-foreground",
      )}
    >
      {/* Active marker is a shape as well as a color, so the state does not
          depend on color perception alone. */}
      {active && (
        <span
          className="bg-accent absolute top-2 bottom-2 -left-0.5 w-0.5 rounded-full"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          active ? "bg-accent/10 text-accent" : "text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  /*
    Which icon shows is decided by CSS, not by a mounted flag in state.

    The resolved theme is unknown during SSR, so the old version set a `mounted`
    boolean in an effect — a cascading render on every page load, and the lint
    rule was right to reject it. Rendering both icons and letting the `dark:`
    variant reveal the correct one needs no state at all, and cannot flash the
    wrong icon because next-themes stamps data-theme before paint.

    The label stays theme-independent for the same reason: an aria-label that
    depended on the resolved theme would differ between server and client.
  */
  return (
    <button
      type="button"
      aria-label="Toggle colour theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="hover:bg-secondary text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-lg transition-colors"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const [signingOut, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-secondary flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors">
        <UserAvatar user={user} size="sm" />
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
          {displayName(user)}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {displayName(user)}
              </p>
              <p className="text-muted-foreground truncate font-mono text-xs">
                {user.email}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="mt-3 text-[10px]">
            {user.role}
          </Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/*
          Calls the server action from onSelect rather than nesting a <form>.
          Radix closes the menu on select, which unmounts this portal — and a
          nested form with it — before the submission can complete, so the
          form-based version silently did nothing. preventDefault() keeps the
          menu mounted until the action has been dispatched.

          It stays a server action so Auth.js supplies the CSRF token and
          deletes the `session` row; clearing the cookie alone would leave a
          valid row behind, which is the whole point of database sessions.
        */}
        <DropdownMenuItem
          disabled={signingOut}
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await signOutAction();
            });
          }}
        >
          <LogOut className="mr-2 size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceProtection() {
  return (
    <div className="border-t p-3">
      <div className="bg-secondary/65 flex items-start gap-2.5 rounded-xl px-3 py-3">
        <span className="bg-card text-accent flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium">Secure workspace</p>
          <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
            Google identity · Domain protected
          </p>
        </div>
      </div>
    </div>
  );
}

function resolveSection(pathname: string): string {
  const item = [...MAIN_NAV, ...ADMIN_NAV].find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );

  if (item) return item.label;
  if (pathname.startsWith("/tasks/")) return "Task details";
  return "Inforvio PM";
}
