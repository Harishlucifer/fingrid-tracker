import { TimesheetTabs } from "@/features/timesheet/timesheet-tabs";
import { canManageOrgSettings } from "@/lib/permissions";
import { requireSession } from "@/server/auth/guards";

export const metadata = { title: "Timesheet · Inforvio PM" };

export default async function TimesheetPage() {
  const ctx = await requireSession();

  /*
    `isAdmin` only changes labels and whether the project filter is offered.
    Whose rows come back is decided server-side from the session role in
    `getResourceTimesheet`, so a non-admin cannot see anyone else's time even if
    this flag were wrong.
  */
  return <TimesheetTabs isAdmin={canManageOrgSettings(ctx.role)} />;
}
