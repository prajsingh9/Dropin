import type { NextRequest } from "next/server";
import { json, readBody, requireActor, route, service } from "@/lib/server/api";

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await service().renameDevice(await requireActor(), id, await readBody(req));
  return json({ ok: true });
});

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await service().removeDevice(await requireActor(), id);
  return json({ ok: true });
});
