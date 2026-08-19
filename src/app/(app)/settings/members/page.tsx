import { MembersView } from "@/features/settings/members/members.view";
import { requireAdminPage } from "@/server/auth/page-guards";

export const metadata = { title: "Members · Inforvio PM" };

export default async function MembersPage() {
  const ctx = await requireAdminPage();
  // Passed down so the view can prevent an admin deactivating themselves.
  return <MembersView currentUserId={ctx.userId} />;
}
