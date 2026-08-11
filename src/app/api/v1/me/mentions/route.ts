import { requireSession } from "@/server/auth/guards";
import { readJson, withApiHandler } from "@/server/http/handler";
import { parsePagination } from "@/server/http/pagination";
import {
  listMyMentions,
  markMentionsRead,
} from "@/server/services/comment.service";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = withApiHandler(
  () => requireSession(),
  async (ctx, req) =>
    listMyMentions(ctx, parsePagination(req.nextUrl.searchParams)),
);

const markReadSchema = z.object({
  mentionIds: z.array(z.string().min(1)).optional(),
});

/** Mark mentions read. With no ids, marks all of the caller's unread mentions. */
export const POST = withApiHandler(
  () => requireSession(),
  async (ctx, req) => {
    const input = await readJson(req, markReadSchema);
    return markMentionsRead(ctx, input.mentionIds);
  },
);
