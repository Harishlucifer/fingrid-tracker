import { BacklogView } from "@/features/projects/backlog/backlog.view";
import { atLeast } from "@/lib/permissions";
import { requireProjectPage } from "@/server/auth/page-guards";

export const metadata = { title: "Backlog · Inforvio PM" };

export default async function BacklogPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectPage(projectId, "VIEW");

  // Moving work in and out of a sprint is an EDIT action; a VIEWER just reads.
  return (
    <BacklogView projectId={projectId} canEdit={atLeast(ctx.access, "EDIT")} />
  );
}
