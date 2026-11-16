import type { NextRequest } from "next/server";
import { json, readBody, requireActor, route, service } from "@/lib/server/api";

export const PUT = route(async (req: NextRequest) => {
  const prefs = await service().updateNotificationPrefs(await requireActor(), await readBody(req));
  return json({ prefs });
});
