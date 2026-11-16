import type { NextRequest } from "next/server";
import { z } from "zod";
import { isSimulatorEnabled } from "@/lib/config";
import { HttpError, json, limit, readBody, requireActor, route, service } from "@/lib/server/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildSimulatedEvent, SIMULATION_ACTIONS } from "@/lib/simulation/scenarios";

const input = z.object({
  action: z.enum(SIMULATION_ACTIONS.map((a) => a.id) as [string, ...string[]]),
  device_id: z.string().uuid(),
});

/**
 * Developer simulator. Disabled in production unless NEXT_PUBLIC_ENABLE_SIMULATOR=true,
 * and only ever targets devices flagged `is_simulated` in the caller's household.
 * Events go through exactly the same pipeline as real firmware events.
 */
export const POST = route(async (req: NextRequest) => {
  if (!isSimulatorEnabled) throw new HttpError(404, "Not found");
  const actor = await requireActor();
  limit(`sim:${actor.profile.id}`, 60, 60_000);
  const { action, device_id } = input.parse(await readBody(req));
  const admin = getSupabaseAdmin();
  const { data: device } = await admin.from("devices").select("id, household_id, is_simulated").eq("id", device_id).maybeSingle();
  if (!device || device.household_id !== actor.member.household_id) throw new HttpError(404, "Device not found");
  if (!device.is_simulated) throw new HttpError(403, "Simulated events can only target simulated devices.");
  const hid = actor.member.household_id;
  const [{ data: parcels }, { data: visitors }] = await Promise.all([
    admin.from("parcels").select("status, courier_name, tracking_number").eq("household_id", hid).eq("status", "expected").limit(20),
    admin.from("visitors").select("id, status").eq("household_id", hid).order("arrived_at", { ascending: false }).limit(10),
  ]);
  const event = buildSimulatedEvent(action as (typeof SIMULATION_ACTIONS)[number]["id"], { household: { id: hid }, parcels: parcels ?? [], visitors: visitors ?? [] }, device_id);
  return json(await service().ingestEvent(event));
});
