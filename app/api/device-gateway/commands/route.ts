import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { json, requireDevice, route } from "@/lib/server/api";

/**
 * Firmware pulls its pending commands (call on every heartbeat or long-poll).
 * Pulling also counts as a heartbeat: the device is marked online.
 */
export const GET = route(async (req: NextRequest) => {
  const device = await requireDevice(req);
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  await admin.from("devices").update({ last_seen_at: now, connection_status: "online" }).eq("id", device.id);
  // Commands older than 2 minutes that act on the physical world are expired, never replayed late.
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  await admin
    .from("device_commands")
    .update({ status: "expired", error: "Not delivered in time", completed_at: now })
    .eq("device_id", device.id)
    .in("status", ["pending", "sent"])
    .in("command_type", ["unlock_compartment", "lock_compartment", "grant_access", "deny_access", "restart_device"])
    .lt("created_at", cutoff);
  const { data } = await admin.from("device_commands").select("id, command_type, payload, created_at").eq("device_id", device.id).eq("status", "pending").order("created_at").limit(20);
  if (data?.length) await admin.from("device_commands").update({ status: "sent" }).in("id", data.map((c) => c.id));
  return json({ commands: data ?? [] });
});
