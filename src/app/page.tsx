import { redirect } from "next/navigation";

import { auth } from "@/server/auth/config";

/**
 * Root is a router only: signed-in users land on the dashboard, everyone else on
 * the login screen. Middleware also redirects unauthenticated visitors, but this
 * keeps the behavior correct if the matcher ever changes.
 */
export default async function RootPage() {
  const session = await auth();
  redirect(session?.user?.isActive ? "/dashboard" : "/login");
}
