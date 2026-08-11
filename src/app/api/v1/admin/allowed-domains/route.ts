import { requireAdmin } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import { parsePagination } from "@/server/http/pagination";
import {
  createAllowedDomain,
  createAllowedDomainSchema,
  listAllowedDomains,
} from "@/server/services/allowed-domain.service";

export const runtime = "nodejs";

export const GET = withApiHandler(
  () => requireAdmin(),
  async (_ctx, req) => {
    const pagination = parsePagination(req.nextUrl.searchParams);
    return listAllowedDomains(pagination);
  },
);

export const POST = withApiHandler(
  () => requireAdmin(),
  async (ctx, req) => {
    const input = await readJson(req, createAllowedDomainSchema);
    return createAllowedDomain(ctx.userId, input);
  },
  { successStatus: 201 },
);
