import { MembersView } from "@/features/settings/members/members.view";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Members · Inforvio PM" };

export default async function MembersPage() {
  const ctx = await requireAdmin();
  // Passed down so the view can prevent an admin deactivating themselves.
  return <MembersView currentUserId={ctx.userId} />;
}
