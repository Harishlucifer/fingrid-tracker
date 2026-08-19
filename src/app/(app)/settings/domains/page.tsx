import { DomainsView } from "@/features/settings/domains/domains.view";
import { requireAdminPage } from "@/server/auth/page-guards";

export const metadata = { title: "Allowed domains · Inforvio PM" };

/**
 * ADMIN-only. The guard runs server-side before anything renders, so a
 * non-admin never receives the markup — hiding the nav link alone would not be
 * access control.
 */
export default async function DomainsPage() {
  await requireAdminPage();
  return <DomainsView />;
}
