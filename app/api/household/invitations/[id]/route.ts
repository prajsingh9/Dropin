import type { NextRequest } from "next/server";
import { json, requireActor, route, service } from "@/lib/server/api";

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await service().revokeInvitation(await requireActor(), id);
  return json({ ok: true });
});
