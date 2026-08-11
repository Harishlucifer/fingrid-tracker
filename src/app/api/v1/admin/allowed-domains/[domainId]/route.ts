import { requireAdmin } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import {
  updateAllowedDomain,
  updateAllowedDomainSchema,
} from "@/server/services/allowed-domain.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ domainId: string }> };

export const PATCH = withApiHandler<Awaited<ReturnType<typeof requireAdmin>>, unknown, RouteArgs>(
  () => requireAdmin(),
  async (ctx, req, args) => {
    const { domainId } = await args.params;
    const input = await readJson(req, updateAllowedDomainSchema);
    return updateAllowedDomain(ctx.userId, domainId, input);
  },
);

/**
 * "Remove" is a deactivation, not a delete: the unique key on `domain` would
 * otherwise block re-adding it, and the audit trail matters. Deactivating also
 * revokes the live sessions of everyone on that domain.
 */
export const DELETE = withApiHandler<Awaited<ReturnType<typeof requireAdmin>>, unknown, RouteArgs>(
  () => requireAdmin(),
  async (ctx, _req, args) => {
    const { domainId } = await args.params;
    return updateAllowedDomain(ctx.userId, domainId, { isActive: false });
  },
);
