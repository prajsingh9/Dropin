import type { TableName, TableRows } from "@/lib/domain/mutations";
import type { Activity, AppNotification, Device, DeviceState, Household, HouseholdMember, Parcel, Profile, QuietHours, Visitor } from "@/types/dropin";
import { uid } from "@/lib/utils";
import { DEFAULT_NOTIFICATION_PREFS, ROLE_DEFAULT_PERMISSIONS } from "@/lib/domain/permissions";

export type DemoTables = { [T in TableName]: TableRows[T][] };

export function emptyTables(): DemoTables {
  return {
    profiles: [],
    households: [],
    household_members: [],
    household_invitations: [],
    devices: [],
    device_states: [],
    device_events: [],
    device_commands: [],
    parcels: [],
    visitors: [],
    activities: [],
    notifications: [],
    quiet_hours: [],
  };
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface DemoIdentity {
  full_name: string;
  email: string;
  phone?: string | null;
}

export const DEMO_IDENTITY: DemoIdentity = { full_name: "Praj Singh", email: "praj@demo.dropin.home", phone: "+91 98450 12345" };

/**
 * A realistic lived-in household for demo mode: a simulated Dropin, a parcel
 * waiting in the compartment, expected deliveries, recent visitors and a
 * history to browse.
 */
export function createSampleTables(identity: DemoIdentity = DEMO_IDENTITY): { tables: DemoTables; userId: string; householdId: string } {
  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const ahead = (min: number) => new Date(now + min * 60_000).toISOString();
  const tz = browserTimeZone();
  const t = emptyTables();

  const userId = uid();
  const partnerId = uid();
  const householdId = uid();
  const deviceId = uid();

  const profile: Profile = { id: userId, full_name: identity.full_name, email: identity.email, phone: identity.phone ?? null, avatar_url: null, created_at: ago(60 * 24 * 40) };
  const partner: Profile = { id: partnerId, full_name: "Ananya Rao", email: "ananya@demo.dropin.home", phone: null, avatar_url: null, created_at: ago(60 * 24 * 30) };
  t.profiles.push(profile, partner);

  const household: Household = { id: householdId, name: "Home", flat_number: "1204", building: "Palm Grove Residences", address: "14 Lavelle Road, Bengaluru 560001", timezone: tz, created_at: ago(60 * 24 * 40) };
  t.households.push(household);

  const owner: HouseholdMember = { id: uid(), household_id: householdId, user_id: userId, role: "owner", permissions: ROLE_DEFAULT_PERMISSIONS.owner, notification_prefs: DEFAULT_NOTIFICATION_PREFS, created_at: ago(60 * 24 * 40), profile: { full_name: profile.full_name, email: profile.email, avatar_url: null } };
  const resident: HouseholdMember = { id: uid(), household_id: householdId, user_id: partnerId, role: "resident", permissions: ROLE_DEFAULT_PERMISSIONS.resident, notification_prefs: DEFAULT_NOTIFICATION_PREFS, created_at: ago(60 * 24 * 30), profile: { full_name: partner.full_name, email: partner.email, avatar_url: null } };
  t.household_members.push(owner, resident);
  t.household_invitations.push({ id: uid(), household_id: householdId, email: "rohan.k@example.com", role: "resident", status: "pending", invited_by: userId, created_at: ago(60 * 26) });

  const device: Device = {
    id: deviceId,
    household_id: householdId,
    device_name: "Front door Dropin",
    device_type: "parcel_collector",
    device_identifier: "SIM-7Q4K-2M8D",
    connection_status: "online",
    firmware_version: "1.4.2",
    wifi_ssid: "Home-5G",
    wifi_signal: 82,
    doorbell_volume: 70,
    doorbell_enabled: true,
    is_simulated: true,
    last_seen_at: ago(1),
    created_at: ago(60 * 24 * 40),
  };
  t.devices.push(device);
  const state: DeviceState = { id: uid(), device_id: deviceId, compartment_status: "occupied", door_status: "closed", lock_status: "locked", camera_status: "ready", door_opened_at: null, last_deposit_at: ago(47), updated_at: ago(47) };
  t.device_states.push(state);

  const quiet: QuietHours = { id: uid(), household_id: householdId, enabled: true, start_time: "00:00", end_time: "07:00", days_of_week: [0, 1, 2, 3, 4, 5, 6], timezone: tz, updated_at: ago(60 * 24 * 12), updated_by: userId, synced_at: ago(60 * 24 * 12) };
  t.quiet_hours.push(quiet);

  const parcel = (p: Partial<Parcel> & Pick<Parcel, "status">): Parcel => ({
    id: uid(),
    household_id: householdId,
    device_id: p.status === "expected" ? null : deviceId,
    courier_name: null,
    sender: null,
    tracking_number: null,
    weight_kg: null,
    image_url: null,
    source: p.status === "expected" ? "manual" : "device",
    expected_at: null,
    deposited_at: null,
    collected_at: null,
    collected_by: null,
    created_at: ago(60),
    ...p,
  });

  const dhl = parcel({ status: "received", courier_name: "DHL", sender: "Muji India", tracking_number: "6523144326956", weight_kg: 2, image_url: "sim://parcel/4182", deposited_at: ago(47), created_at: ago(60 * 24 * 2) });
  const fedex = parcel({ status: "expected", courier_name: "FedEx", sender: "Nothing Technology", tracking_number: "7781 2290 4413", weight_kg: 1, expected_at: ahead(150), created_at: ago(60 * 24) });
  const amazon = parcel({ status: "expected", courier_name: "Amazon", sender: "Amazon.in", tracking_number: "AMZ-402-8817332", expected_at: ahead(60 * 22), created_at: ago(60 * 10) });
  const bluedart = parcel({ status: "expected", courier_name: "Blue Dart", sender: "Bombay Shirt Company", tracking_number: "84017725531", weight_kg: 0.6, expected_at: ahead(60 * 46), created_at: ago(60 * 5) });
  const delhivery = parcel({ status: "collected", courier_name: "Delhivery", sender: "Blue Tokai Coffee", tracking_number: "1490 8812 0034", weight_kg: 1.2, image_url: "sim://parcel/917", deposited_at: ago(60 * 27), collected_at: ago(60 * 22), collected_by: userId, created_at: ago(60 * 24 * 4) });
  const unknown = parcel({ status: "collected", courier_name: null, weight_kg: 0.4, image_url: "sim://parcel/55", deposited_at: ago(60 * 24 * 3 + 200), collected_at: ago(60 * 24 * 3), collected_by: partnerId, created_at: ago(60 * 24 * 3 + 200) });
  const amazonOld = parcel({ status: "collected", courier_name: "Amazon", sender: "Amazon.in", tracking_number: "AMZ-402-7716120", weight_kg: 3.4, image_url: "sim://parcel/2210", deposited_at: ago(60 * 24 * 5 + 300), collected_at: ago(60 * 24 * 5), collected_by: userId, created_at: ago(60 * 24 * 7) });
  t.parcels.push(dhl, fedex, amazon, bluedart, delhivery, unknown, amazonOld);

  const visitor = (v: Partial<Visitor> & Pick<Visitor, "status" | "arrived_at">): Visitor => ({
    id: uid(),
    household_id: householdId,
    device_id: deviceId,
    visitor_name: null,
    image_url: null,
    request_type: "doorbell",
    during_quiet_hours: false,
    chime_played: true,
    responded_at: null,
    responded_by: null,
    ...v,
  });
  const v1 = visitor({ status: "answered", visitor_name: "Courier", image_url: "sim://visitor/301", arrived_at: ago(49), responded_at: ago(48), responded_by: userId });
  const v2 = visitor({ status: "approved", visitor_name: "Ananya", request_type: "building_entry", image_url: "sim://visitor/77", arrived_at: ago(60 * 5), responded_at: ago(60 * 5 - 1), responded_by: userId, chime_played: false });
  const v3 = visitor({ status: "missed", image_url: "sim://visitor/913", arrived_at: ago(60 * 19), during_quiet_hours: true, chime_played: false });
  const v4 = visitor({ status: "denied", request_type: "building_entry", image_url: "sim://visitor/5120", arrived_at: ago(60 * 30), responded_at: ago(60 * 30 - 1), responded_by: partnerId, chime_played: false });
  const v5 = visitor({ status: "approved", visitor_name: "Delivery partner", request_type: "leave_parcel", image_url: "sim://visitor/640", arrived_at: ago(60 * 27 + 2), responded_at: ago(60 * 27 + 1), responded_by: userId, chime_played: false });
  t.visitors.push(v1, v2, v3, v4, v5);

  const act = (a: Omit<Activity, "id" | "household_id" | "device_id" | "actor_id" | "metadata"> & { metadata?: Record<string, unknown>; actor_id?: string | null }): Activity => ({
    id: uid(),
    household_id: householdId,
    device_id: deviceId,
    actor_id: null,
    metadata: {},
    ...a,
  });
  t.activities.push(
    act({ event_type: "parcel_deposited", category: "parcels", title: "Parcel received", description: "Delivered by DHL. The compartment locked automatically.", metadata: { parcel_id: dhl.id, courier_name: "DHL" }, created_at: ago(47) }),
    act({ event_type: "doorbell_pressed", category: "visitors", title: "Doorbell pressed", description: "A courier rang the bell and was answered from the app.", metadata: { visitor_id: v1.id }, created_at: ago(49) }),
    act({ event_type: "access_granted", category: "security", title: "Access granted", description: `${profile.full_name} let Ananya into the building.`, metadata: { visitor_id: v2.id, via: "app" }, actor_id: userId, created_at: ago(60 * 5 - 1) }),
    act({ event_type: "doorbell_pressed", category: "visitors", title: "Doorbell pressed", description: "Quiet hours were on, so the chime stayed silent.", metadata: { visitor_id: v3.id, chime: false }, created_at: ago(60 * 19) }),
    act({ event_type: "parcel_collected", category: "parcels", title: "Parcel collected", description: "Delhivery parcel collected from the compartment.", metadata: { parcel_ids: [delhivery.id] }, actor_id: userId, created_at: ago(60 * 22) }),
    act({ event_type: "compartment_closed", category: "security", title: "Compartment closed", description: "Closed and locked.", created_at: ago(60 * 22 - 1) }),
    act({ event_type: "compartment_opened", category: "security", title: "Compartment opened", description: "The parcel door was opened.", created_at: ago(60 * 22 + 1) }),
    act({ event_type: "parcel_deposited", category: "parcels", title: "Parcel received", description: "Delivered by Delhivery.", metadata: { parcel_id: delhivery.id, courier_name: "Delhivery" }, created_at: ago(60 * 27) }),
    act({ event_type: "access_granted", category: "security", title: "Access granted", description: "A delivery partner was allowed to leave a parcel.", metadata: { visitor_id: v5.id, via: "app" }, actor_id: userId, created_at: ago(60 * 27 + 1) }),
    act({ event_type: "access_denied", category: "security", title: "Access denied", description: "Ananya Rao denied an unknown visitor's building entry request.", metadata: { visitor_id: v4.id, via: "app" }, actor_id: partnerId, created_at: ago(60 * 30 - 1) }),
    act({ event_type: "device_online", category: "device", title: "Device reconnected", description: "Front door Dropin is back online after a 4 minute Wi-Fi drop.", created_at: ago(60 * 24 * 2) }),
    act({ event_type: "device_offline", category: "device", title: "Device disconnected", description: "Front door Dropin went offline.", created_at: ago(60 * 24 * 2 + 4) }),
    act({ event_type: "parcel_deposited", category: "parcels", title: "Parcel received", description: "Delivered by an unidentified courier.", metadata: { parcel_id: unknown.id }, created_at: ago(60 * 24 * 3 + 200) }),
  );

  const note = (n: Omit<AppNotification, "id" | "household_id" | "user_id" | "image_url" | "silent" | "read_at"> & Partial<Pick<AppNotification, "image_url" | "silent" | "read_at">>): AppNotification => ({
    id: uid(),
    household_id: householdId,
    user_id: userId,
    image_url: null,
    silent: false,
    read_at: null,
    ...n,
  });
  t.notifications.push(
    note({ event_type: "parcel_received", category: "parcels", title: "Your parcel has arrived", description: "Your DHL parcel was deposited 47 minutes ago.", image_url: dhl.image_url, action_url: `/parcels/${dhl.id}`, created_at: ago(47) }),
    note({ event_type: "doorbell_pressed", category: "visitors", title: "Someone is at your door", description: "The doorbell was pressed.", image_url: v1.image_url, action_url: `/visitors/${v1.id}`, created_at: ago(49), read_at: ago(48) }),
    note({ event_type: "access_granted", category: "security", title: "Access granted", description: "Ananya was let into the building.", action_url: `/visitors/${v2.id}`, created_at: ago(60 * 5 - 1), read_at: ago(60 * 5 - 2) }),
    note({ event_type: "doorbell_pressed", category: "visitors", title: "Someone is at your door", description: "The doorbell was pressed during quiet hours (no chime).", image_url: v3.image_url, action_url: `/visitors/${v3.id}`, silent: true, created_at: ago(60 * 19) }),
    note({ event_type: "parcel_collected", category: "parcels", title: "Parcel collected", description: "Your compartment was emptied.", action_url: "/parcels?tab=collected", created_at: ago(60 * 22), read_at: ago(60 * 21) }),
    note({ event_type: "device_reconnected", category: "device", title: "Device reconnected", description: "Front door Dropin is back online.", action_url: "/device", created_at: ago(60 * 24 * 2), read_at: ago(60 * 24 * 2) }),
    note({ event_type: "device_disconnected", category: "device", title: "Device disconnected", description: "Front door Dropin lost its connection.", action_url: "/device", created_at: ago(60 * 24 * 2 + 4), read_at: ago(60 * 24 * 2) }),
  );

  return { tables: t, userId, householdId };
}
