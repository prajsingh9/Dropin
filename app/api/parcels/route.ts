import type { NextRequest } from "next/server";
import { json, readBody, requireActor, route, service } from "@/lib/server/api";

export const POST = route(async (req: NextRequest) => {
  const actor = await requireActor();
  const parcel = await service().addExpectedParcel(actor, await readBody(req));
  return json({ parcel }, 201);
});
