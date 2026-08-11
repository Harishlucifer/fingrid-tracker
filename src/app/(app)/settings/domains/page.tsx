import { DomainsView } from "@/features/settings/domains/domains.view";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Allowed domains · Inforvio PM" };

/**
 * ADMIN-only. The guard runs server-side before anything renders, so a
 * non-admin never receives the markup — hiding the nav link alone would not be
 * access control.
 */
export default async function DomainsPage() {
  await requireAdmin();
  return <DomainsView />;
}
