import { requireAdmin } from "@/server/auth/guards";
import { withApiHandler } from "@/server/http/handler";
import { parsePagination } from "@/server/http/pagination";
import { listUsers } from "@/server/services/user.service";

export const runtime = "nodejs";

export const GET = withApiHandler(
  () => requireAdmin(),
  async (_ctx, req) => {
    const pagination = parsePagination(req.nextUrl.searchParams);
    const search = req.nextUrl.searchParams.get("q") ?? undefined;
    return listUsers(pagination, search);
  },
);
