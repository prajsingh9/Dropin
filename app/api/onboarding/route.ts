import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { isSimulatorEnabled } from "@/lib/config";
import { HttpError, hashSecret, json, limit, readBody, requireUser, route } from "@/lib/server/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { onboardingInput } from "@/lib/backend/schemas";
import { DEFAULT_NOTIFICATION_PREFS, ROLE_DEFAULT_PERMISSIONS } from "@/lib/domain/permissions";

/**
 * Creates the household, owner membership and device in one request.
 * Real devices are stored as `pending` — they become `online` only when the
 * hardware itself authenticates against the device gateway.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  limit(`onboard:${user.id}`, 10, 10 * 60_000);
  const data = onboardingInput.parse(await readBody(req));
  const simulated = data.device.simulated || data.device.device_identifier.startsWith("SIM-");
  if (simulated && !isSimulatorEnabled) throw new HttpError(403, "Simulated devices aren't available in this environment.");

  const admin = getSupabaseAdmin();
  const { data: existingMember } = await admin.from("household_members").select("id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existingMember) throw new HttpError(409, "You already belong to a household.");
  const { data: taken } = await admin.from("devices").select("id").eq("device_identifier", data.device.device_identifier).maybeSingle();
  if (taken) throw new HttpError(409, "That device is already paired to a home. Ask its owner to remove it first.");

  const now = new Date().toISOString();
  const householdId = randomUUID();
  const deviceId = randomUUID();
  const steps = [
    () => admin.from("profiles").upsert({ id: user.id, email: user.email, full_name: data.full_name, phone: data.phone || null }),
    () => admin.from("households").insert({ id: householdId, ...data.household, created_by: user.id }),
    () => admin.from("household_members").insert({ household_id: householdId, user_id: user.id, role: "owner", permissions: ROLE_DEFAULT_PERMISSIONS.owner, notification_prefs: DEFAULT_NOTIFICATION_PREFS }),
    () =>
      admin.from("devices").insert({
        id: deviceId,
        household_id: householdId,
        device_name: data.device.device_name,
        device_type: "parcel_collector",
        device_identifier: data.device.device_identifier,
        device_secret_hash: hashSecret(data.device.pairing_code),
        connection_status: simulated ? "online" : "pending",
        firmware_version: simulated ? "1.4.2" : null,
        wifi_ssid: data.wifi_ssid ?? null,
        wifi_signal: simulated ? 78 : null,
        is_simulated: simulated,
        last_seen_at: simulated ? now : null,
      }),
    () => admin.from("device_states").insert({ device_id: deviceId, household_id: householdId }),
    () => admin.from("quiet_hours").insert({ household_id: householdId, enabled: false, start_time: "00:00", end_time: "07:00", days_of_week: [0, 1, 2, 3, 4, 5, 6], timezone: data.household.timezone, updated_by: user.id }),
    () => admin.from("activities").insert({ household_id: householdId, device_id: deviceId, event_type: "device_online", category: "device", title: "Dropin paired", description: `${data.device.device_name} (${data.device.device_identifier}) was added to ${data.household.name}.`, metadata: { simulated }, actor_id: user.id }),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) {
      // Roll back the partially created household (cascades to children).
      await admin.from("households").delete().eq("id", householdId);
      throw new HttpError(500, `Setup failed: ${error.message}`);
    }
  }
  return json({ household_id: householdId, device_id: deviceId }, 201);
});
