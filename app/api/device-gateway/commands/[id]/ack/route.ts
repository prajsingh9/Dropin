import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, readBody, requireDevice, route, service } from "@/lib/server/api";

const input = z.object({ success: z.boolean(), error: z.string().max(200).optional() });

/** Firmware confirms (or rejects) a command. Only now does the app show it as done. */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const device = await requireDevice(req);
  const result = input.parse(await readBody(req));
  const command = await service().acknowledgeCommand(device.id, id, result);
  return json({ command });
});
