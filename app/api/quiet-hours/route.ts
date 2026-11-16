import type { NextRequest } from "next/server";
import { json, limit, readBody, requireActor, route, service } from "@/lib/server/api";

export const PUT = route(async (req: NextRequest) => {
  const actor = await requireActor();
  limit(`quiet:${actor.profile.id}`, 20, 60_000);
  const result = await service().updateQuietHours(actor, await readBody(req));
  return json(result);
});
