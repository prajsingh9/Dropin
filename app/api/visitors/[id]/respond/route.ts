import type { NextRequest } from "next/server";
import { json, limit, readBody, requireActor, route, service } from "@/lib/server/api";
import { visitorResponseInput } from "@/lib/backend/schemas";

/** Answer / decline / approve / deny a visitor. Approvals and denials are audited. */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await requireActor();
  limit(`visitor:${actor.profile.id}`, 30, 60_000);
  const { decision } = visitorResponseInput.parse(await readBody(req));
  return json(await service().respondToVisitor(actor, id, decision));
});
