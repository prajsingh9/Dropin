import type {
  Activity,
  ActivityCategory,
  AppNotification,
  Device,
  DeviceCommand,
  DeviceState,
  Household,
  HouseholdMember,
  NotificationKind,
  Parcel,
  QuietHours,
  Visitor,
} from "@/types/dropin";
import { uid } from "@/lib/utils";
import { type DeviceEvent, leftOpenMeta, parcelDepositMeta, quietSyncMeta, visitorMeta } from "./events";
import { insert, update, type Mutation, type PushMessage } from "./mutations";
import { isQuietHoursActive } from "./quiet-hours";
import { DEFAULT_NOTIFICATION_PREFS } from "./permissions";
import { formatTime } from "./format";

export interface ProcessorContext {
  household: Household;
  device: Device;
  state: DeviceState;
  quietHours: QuietHours | null;
  members: HouseholdMember[];
  /** Parcels with status expected or received. */
  openParcels: Parcel[];
  /** Visitors from the last 15 minutes that are still unresolved. */
  recentVisitors: Visitor[];
  /** Commands that are still pending for this device. */
  pendingCommands: DeviceCommand[];
}

/** What the backend tells the device in reply to an event. */
export interface DeviceEventResponse {
  event_id: string;
  /** Whether the outdoor unit may play its audible chime. Enforced server-side. */
  chime: boolean;
  quiet_hours_active: boolean;
  visitor_id?: string;
  parcel_id?: string;
}

export interface ProcessResult {
  mutations: Mutation[];
  push: PushMessage[];
  response: DeviceEventResponse;
  /** Commands that should be (re)dispatched, e.g. queued settings after reconnect. */
  dispatchCommandIds: string[];
}

const PREF_FOR_CATEGORY: Record<ActivityCategory, "parcels" | "visitors" | "device" | "security"> = {
  parcels: "parcels",
  visitors: "visitors",
  device: "device",
  security: "security",
};

export function processDeviceEvent(ctx: ProcessorContext, event: DeviceEvent): ProcessResult {
  const at = new Date(event.timestamp);
  const ts = at.toISOString();
  const tz = ctx.household.timezone;
  const quiet = isQuietHoursActive(ctx.quietHours, at);
  const mutations: Mutation[] = [];
  const push: PushMessage[] = [];
  const dispatchCommandIds: string[] = [];
  const response: DeviceEventResponse = { event_id: event.event_id, chime: false, quiet_hours_active: quiet };
  const { device, state } = ctx;

  // Any event proves the device is alive.
  const deviceTouch: Partial<Device> = { last_seen_at: ts };
  if (event.event_type !== "device_offline" && device.connection_status !== "online") {
    deviceTouch.connection_status = "online";
  }

  const activity = (a: Omit<Activity, "id" | "household_id" | "device_id" | "created_at" | "actor_id"> & { actor_id?: string | null }) => {
    const row: Activity = {
      id: uid(),
      household_id: ctx.household.id,
      device_id: device.id,
      created_at: ts,
      actor_id: a.actor_id ?? null,
      event_type: a.event_type,
      category: a.category,
      title: a.title,
      description: a.description,
      metadata: { ...a.metadata, event_id: event.event_id, quiet_hours: quiet },
    };
    mutations.push(insert("activities", row));
    return row;
  };

  /**
   * Fan a notification out to every member whose preferences allow it.
   * Visitor and parcel notifications are silent during quiet hours; security
   * alerts always use sound.
   */
  const notify = (n: { kind: NotificationKind; category: ActivityCategory; title: string; description: string; image_url?: string | null; action_url?: string | null; quietSensitive?: boolean }) => {
    for (const m of ctx.members) {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...m.notification_prefs };
      if (!prefs[PREF_FOR_CATEGORY[n.category]]) continue;
      const silent = Boolean(n.quietSensitive && quiet);
      const row: AppNotification = {
        id: uid(),
        household_id: ctx.household.id,
        user_id: m.user_id,
        event_type: n.kind,
        category: n.category,
        title: n.title,
        description: n.description,
        image_url: n.image_url ?? null,
        action_url: n.action_url ?? null,
        silent,
        read_at: null,
        created_at: ts,
      };
      mutations.push(insert("notifications", row));
      const held = silent && prefs.quiet_mode === "hold";
      if (!held) {
        push.push({ user_id: m.user_id, title: n.title, body: n.description, url: n.action_url ?? null, silent, tag: `${n.kind}:${event.event_id}` });
      }
    }
  };

  const setState = (values: Partial<DeviceState>) => mutations.push(update("device_states", state.id, { ...values, updated_at: ts }));

  switch (event.event_type) {
    case "parcel_deposited": {
      const meta = parcelDepositMeta.safeParse(event.metadata);
      const m = meta.success ? meta.data : {};
      const courier = m.courier_name?.trim() || null;
      const expected = ctx.openParcels.filter((p) => p.status === "expected");
      // Match an expected parcel by tracking number first, then by a unique courier match.
      let match = m.tracking_number ? expected.find((p) => p.tracking_number && p.tracking_number === m.tracking_number) : undefined;
      if (!match && courier) {
        const byCourier = expected.filter((p) => p.courier_name?.toLowerCase() === courier.toLowerCase());
        if (byCourier.length === 1) match = byCourier[0];
      }
      let parcelId: string;
      if (match) {
        parcelId = match.id;
        mutations.push(
          update("parcels", match.id, {
            status: "received",
            device_id: device.id,
            deposited_at: ts,
            weight_kg: m.weight_kg ?? match.weight_kg,
            image_url: m.image_url ?? match.image_url,
            courier_name: match.courier_name ?? courier,
          }),
        );
      } else {
        parcelId = uid();
        mutations.push(
          insert("parcels", {
            id: parcelId,
            household_id: ctx.household.id,
            device_id: device.id,
            courier_name: courier,
            sender: m.sender ?? null,
            tracking_number: m.tracking_number ?? null,
            weight_kg: m.weight_kg ?? null,
            image_url: m.image_url ?? null,
            status: "received",
            source: "device",
            expected_at: null,
            deposited_at: ts,
            collected_at: null,
            collected_by: null,
            created_at: ts,
          }),
        );
      }
      response.parcel_id = parcelId;
      setState({ compartment_status: "occupied", door_status: "closed", lock_status: "locked", last_deposit_at: ts, door_opened_at: null });
      const courierLabel = match?.courier_name ?? courier;
      const by = courierLabel ? `Delivered by ${courierLabel}` : "Delivered by an unidentified courier";
      activity({ event_type: "parcel_deposited", category: "parcels", title: "Parcel received", description: `${by} at ${formatTime(ts, tz)}.`, metadata: { parcel_id: parcelId, courier_name: courierLabel } });
      notify({
        kind: "parcel_received",
        category: "parcels",
        title: "Your parcel has arrived",
        description: courierLabel ? `Your ${courierLabel} parcel was deposited at ${formatTime(ts, tz)}.` : `A parcel was deposited at ${formatTime(ts, tz)}. The courier wasn't identified.`,
        image_url: m.image_url ?? null,
        action_url: `/parcels/${parcelId}`,
        quietSensitive: true,
      });
      break;
    }

    case "parcel_collected": {
      const received = ctx.openParcels.filter((p) => p.status === "received" && (p.device_id === device.id || p.device_id === null));
      for (const p of received) mutations.push(update("parcels", p.id, { status: "collected", collected_at: ts }));
      setState({ compartment_status: "empty", last_deposit_at: null });
      const count = received.length;
      activity({
        event_type: "parcel_collected",
        category: "parcels",
        title: count > 1 ? `${count} parcels collected` : "Parcel collected",
        description: count ? `Collected from the compartment at ${formatTime(ts, tz)}.` : `The compartment was emptied at ${formatTime(ts, tz)}.`,
        metadata: { parcel_ids: received.map((p) => p.id) },
      });
      notify({ kind: "parcel_collected", category: "parcels", title: "Parcel collected", description: `Your compartment was emptied at ${formatTime(ts, tz)}.`, action_url: "/parcels?tab=collected", quietSensitive: true });
      break;
    }

    case "compartment_opened": {
      setState({ door_status: "open", door_opened_at: ts });
      activity({ event_type: "compartment_opened", category: "security", title: "Compartment opened", description: `The parcel door was opened at ${formatTime(ts, tz)}.`, metadata: {} });
      break;
    }

    case "compartment_closed": {
      // Dropin re-locks automatically when the door closes.
      setState({ door_status: "closed", lock_status: "locked", door_opened_at: null });
      activity({ event_type: "compartment_closed", category: "security", title: "Compartment closed", description: `Closed and locked at ${formatTime(ts, tz)}.`, metadata: {} });
      break;
    }

    case "compartment_left_open": {
      const meta = leftOpenMeta.safeParse(event.metadata);
      const secs = meta.success && meta.data.open_seconds ? meta.data.open_seconds : 120;
      const mins = Math.max(1, Math.round(secs / 60));
      setState({ door_status: "open", door_opened_at: state.door_opened_at ?? new Date(at.getTime() - secs * 1000).toISOString() });
      activity({ event_type: "compartment_left_open", category: "security", title: "Compartment left open", description: `The parcel door has been open for ${mins} minute${mins === 1 ? "" : "s"}.`, metadata: { open_seconds: secs } });
      notify({ kind: "compartment_left_open", category: "security", title: "Compartment left open", description: `Your parcel compartment has remained open for ${mins} minute${mins === 1 ? "" : "s"}.`, action_url: "/device" });
      break;
    }

    case "visitor_detected":
    case "doorbell_pressed": {
      const meta = visitorMeta.safeParse(event.metadata);
      const m = meta.success ? meta.data : {};
      const ring = event.event_type === "doorbell_pressed";
      const chime = ring && device.doorbell_enabled && !quiet;
      // A ring shortly after motion detection belongs to the same visit.
      const recentDetected = ring
        ? ctx.recentVisitors.find((v) => v.device_id === device.id && v.status === "detected" && at.getTime() - new Date(v.arrived_at).getTime() < 3 * 60_000)
        : undefined;
      let visitorId: string;
      if (recentDetected) {
        visitorId = recentDetected.id;
        mutations.push(update("visitors", visitorId, { status: "ringing", during_quiet_hours: quiet, chime_played: chime, image_url: m.image_url ?? recentDetected.image_url }));
      } else {
        visitorId = uid();
        mutations.push(
          insert("visitors", {
            id: visitorId,
            household_id: ctx.household.id,
            device_id: device.id,
            visitor_name: m.visitor_name ?? null,
            image_url: m.image_url ?? null,
            request_type: "doorbell",
            status: ring ? "ringing" : "detected",
            during_quiet_hours: quiet,
            chime_played: chime,
            arrived_at: ts,
            responded_at: null,
            responded_by: null,
          }),
        );
      }
      response.visitor_id = visitorId;
      response.chime = chime;
      if (ring) {
        const chimeNote = quiet ? " Quiet hours are on, so the chime stayed silent." : !device.doorbell_enabled ? " The chime is turned off." : "";
        activity({ event_type: "doorbell_pressed", category: "visitors", title: "Doorbell pressed", description: `Someone pressed the doorbell at ${formatTime(ts, tz)}.${chimeNote}`, metadata: { visitor_id: visitorId, chime } });
        notify({ kind: "doorbell_pressed", category: "visitors", title: "Someone is at your door", description: `The doorbell was pressed at ${formatTime(ts, tz)}.${quiet ? " (Quiet hours — no chime)" : ""}`, image_url: m.image_url ?? null, action_url: `/visitors/live/${visitorId}`, quietSensitive: true });
      } else {
        activity({ event_type: "visitor_detected", category: "visitors", title: "Visitor at the door", description: `The camera detected someone at ${formatTime(ts, tz)}.`, metadata: { visitor_id: visitorId } });
        notify({ kind: "visitor_at_door", category: "visitors", title: "Visitor at your door", description: `Someone was detected at your door at ${formatTime(ts, tz)}.`, image_url: m.image_url ?? null, action_url: `/visitors/${visitorId}`, quietSensitive: true });
      }
      break;
    }

    case "access_requested": {
      const meta = visitorMeta.safeParse(event.metadata);
      const m = meta.success ? meta.data : {};
      const requestType = m.request_type && m.request_type !== "doorbell" ? m.request_type : "building_entry";
      const visitorId = uid();
      mutations.push(
        insert("visitors", {
          id: visitorId,
          household_id: ctx.household.id,
          device_id: device.id,
          visitor_name: m.visitor_name ?? null,
          image_url: m.image_url ?? null,
          request_type: requestType,
          status: "pending",
          during_quiet_hours: quiet,
          chime_played: false,
          arrived_at: ts,
          responded_at: null,
          responded_by: null,
        }),
      );
      response.visitor_id = visitorId;
      const what = REQUEST_LABEL[requestType];
      const who = m.visitor_name ?? "A visitor";
      activity({ event_type: "access_requested", category: "security", title: "Access requested", description: `${who} asked to ${what.toLowerCase()}.`, metadata: { visitor_id: visitorId, request_type: requestType } });
      notify({ kind: "access_request", category: "security", title: "Access request", description: `${who} is asking to ${what.toLowerCase()}.`, image_url: m.image_url ?? null, action_url: `/visitors/${visitorId}`, quietSensitive: true });
      break;
    }

    case "access_granted":
    case "access_denied": {
      const meta = visitorMeta.safeParse(event.metadata);
      const m = meta.success ? meta.data : {};
      const granted = event.event_type === "access_granted";
      const target = m.visitor_id ? ctx.recentVisitors.find((v) => v.id === m.visitor_id) : ctx.recentVisitors.find((v) => v.status === "pending" || v.status === "ringing" || v.status === "answered");
      if (target) mutations.push(update("visitors", target.id, { status: granted ? "approved" : "denied", responded_at: ts }));
      const via = m.via ?? "indoor monitor";
      activity({
        event_type: event.event_type,
        category: "security",
        title: granted ? "Access granted" : "Access denied",
        description: `${granted ? "Granted" : "Denied"} from the ${via} at ${formatTime(ts, tz)}.`,
        metadata: { visitor_id: target?.id ?? null, via },
      });
      notify({ kind: granted ? "access_granted" : "access_denied", category: "security", title: granted ? "Access granted" : "Access denied", description: `A visitor was ${granted ? "let in" : "turned away"} via the ${via} at ${formatTime(ts, tz)}.`, action_url: target ? `/visitors/${target.id}` : "/visitors", quietSensitive: true });
      break;
    }

    case "device_offline": {
      deviceTouch.connection_status = "offline";
      delete deviceTouch.last_seen_at; // last_seen stays at the last time we heard from it
      setState({ camera_status: "offline" });
      activity({ event_type: "device_offline", category: "device", title: "Device disconnected", description: `${device.device_name} went offline at ${formatTime(ts, tz)}.`, metadata: {} });
      notify({ kind: "device_disconnected", category: "device", title: "Device disconnected", description: `${device.device_name} lost its connection at ${formatTime(ts, tz)}. Settings changes will sync when it reconnects.`, action_url: "/device" });
      break;
    }

    case "device_online": {
      setState({ camera_status: "ready" });
      if (device.connection_status !== "online") {
        activity({ event_type: "device_online", category: "device", title: "Device reconnected", description: `${device.device_name} is back online.`, metadata: {} });
        notify({ kind: "device_reconnected", category: "device", title: "Device reconnected", description: `${device.device_name} reconnected at ${formatTime(ts, tz)}.`, action_url: "/device" });
      }
      // Settings that were changed while offline are delivered now.
      for (const c of ctx.pendingCommands) {
        if (c.status === "pending" && QUEUEABLE_COMMANDS.has(c.command_type)) dispatchCommandIds.push(c.id);
      }
      break;
    }

    case "camera_stream_available": {
      setState({ camera_status: "streaming" });
      break;
    }

    case "quiet_hours_updated": {
      // Devices can only *acknowledge* the schedule they were sent; they can never change it.
      const meta = quietSyncMeta.safeParse(event.metadata);
      if (ctx.quietHours) mutations.push(update("quiet_hours", ctx.quietHours.id, { synced_at: ts }));
      if (meta.success && meta.data.command_id) {
        const cmd = ctx.pendingCommands.find((c) => c.id === meta.data.command_id);
        if (cmd) mutations.push(update("device_commands", cmd.id, { status: "completed", completed_at: ts }));
      }
      break;
    }
  }

  mutations.push(update("devices", device.id, deviceTouch));
  return { mutations, push, response, dispatchCommandIds };
}

export const REQUEST_LABEL: Record<Visitor["request_type"], string> = {
  doorbell: "Rang the doorbell",
  building_entry: "Enter the building",
  parcel_delivery: "Deliver a parcel",
  leave_parcel: "Leave a parcel",
};

/** Commands that make sense to hold until an offline device returns. */
export const QUEUEABLE_COMMANDS = new Set<DeviceCommand["command_type"]>(["set_quiet_hours", "set_doorbell_volume", "enable_doorbell", "disable_doorbell"]);
