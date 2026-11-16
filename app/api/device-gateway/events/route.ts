import type { NextRequest } from "next/server";
import { HttpError, json, readBody, requireDevice, route, service } from "@/lib/server/api";

/**
 * Firmware → cloud event ingestion.
 *
 *   POST /api/device-gateway/events
 *   Authorization: Bearer <DEVICE_IDENTIFIER>.<PAIRING_CODE>
 *   { event_id, device_id, household_id, event_type, timestamp, metadata }
 *
 * The response tells the doorbell whether it may chime (quiet hours are
 * enforced here, not on the device UI), so a visitor can't bypass them.
 */
export const POST = route(async (req: NextRequest) => {
  const device = await requireDevice(req);
  const body = (await readBody(req)) as Record<string, unknown>;
  if (body.device_id !== device.id || body.household_id !== device.household_id) throw new HttpError(403, "Event does not match the authenticated device");
  if (body.event_type === "quiet_hours_updated" && body.metadata && typeof body.metadata === "object") {
    // Devices may only acknowledge a schedule; strip anything that looks like a new schedule.
    const { command_id } = body.metadata as Record<string, unknown>;
    body.metadata = { command_id };
  }
  return json(await service().ingestEvent(body));
});
