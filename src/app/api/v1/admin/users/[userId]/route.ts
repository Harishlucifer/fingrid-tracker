import { requireAdmin } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import { updateUser, updateUserSchema } from "@/server/services/user.service";

export const runtime = "nodejs";

type RouteArgs = { params: Promise<{ userId: string }> };

export const PATCH = withApiHandler<
  Awaited<ReturnType<typeof requireAdmin>>,
  unknown,
  RouteArgs
>(
  () => requireAdmin(),
  async (ctx, req, args) => {
    const { userId } = await args.params;
    const input = await readJson(req, updateUserSchema);
    return updateUser(ctx.userId, userId, input);
  },
);
