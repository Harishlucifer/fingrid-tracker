import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getSession } from "@/server/auth/guards";

/**
 * The authenticated boundary.
 *
 * This is a real gate, unlike `src/middleware.ts`: it runs in Node, reads the
 * database-backed session, and re-checks `isActive` so a user deactivated
 * mid-session is ejected on their next navigation rather than at session expiry.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Shared with the page below via React `cache` — one session query per
  // request, not one per component that asks.
  const session = await getSession();

  if (!session?.user?.id) redirect("/login");
  if (!session.user.isActive) redirect("/login?error=AccountDisabled");

  return (
    <AppShell
      user={{
        name: session.user.name ?? session.user.email ?? "Unknown",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
        role: session.user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
