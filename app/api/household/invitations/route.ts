import type { NextRequest } from "next/server";
import { json, limit, readBody, requireActor, route, service } from "@/lib/server/api";

export const POST = route(async (req: NextRequest) => {
  const actor = await requireActor();
  limit(`invite:${actor.profile.id}`, 10, 60 * 60_000);
  const invitation = await service().inviteMember(actor, await readBody(req));
  return json({ invitation }, 201);
});
