import type { NextRequest } from "next/server";
import { json, requireActor, route, service } from "@/lib/server/api";

export const POST = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parcel = await service().markParcelCollected(await requireActor(), id);
  return json({ parcel });
});
