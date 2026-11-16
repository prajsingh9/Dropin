import type { NextRequest } from "next/server";
import { json, readBody, requireActor, route, service } from "@/lib/server/api";

export const PATCH = route(async (req: NextRequest) => {
  await service().updateProfile(await requireActor(), await readBody(req));
  return json({ ok: true });
});
