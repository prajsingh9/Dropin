import type { NextRequest } from "next/server";
import { json, limit, readBody, requireActor, route, service } from "@/lib/server/api";
import { commandInput } from "@/lib/backend/schemas";

/** Resident → device command. Returns the command with its *real* status (pending until the device confirms). */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireActor();
  limit(`cmd:${actor.profile.id}`, 20, 60_000);
  const input = commandInput.parse(await readBody(req));
  const command = await service().issueCommand(actor, input);
  return json({ command }, command.status === "completed" ? 200 : 202);
});
