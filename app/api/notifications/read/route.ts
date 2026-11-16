import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, readBody, requireActor, route, service } from "@/lib/server/api";

const input = z.object({ ids: z.union([z.literal("all"), z.array(z.string().uuid()).max(500)]) });

export const POST = route(async (req: NextRequest) => {
  const { ids } = input.parse(await readBody(req));
  const count = await service().markNotificationsRead(await requireActor(), ids);
  return json({ count });
});
