import { requireSession } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { listAssignableUsers } from "@/server/services/user.service";

export const runtime = "nodejs";

/**
 * Active users, for assignee pickers, project-member pickers and @mention
 * autocomplete. Any signed-in user may read it — names and emails of colleagues
 * are not sensitive within a single-org tool, and every picker needs it.
 */
export const GET = withApiHandler(
  () => requireSession(),
  async () => listAssignableUsers(),
);
