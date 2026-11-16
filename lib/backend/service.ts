import type { z } from "zod";
import type {
  Activity,
  Device,
  DeviceCommand,
  DeviceCommandType,
  DeviceState,
  HouseholdMember,
  NotificationPrefs,
  Parcel,
  Profile,
  QuietHours,
  Visitor,
} from "@/types/dropin";
import { uid } from "@/lib/utils";
import { deviceEventSchema, type DeviceEvent, type StoredDeviceEvent } from "@/lib/domain/events";
import { processDeviceEvent, REQUEST_LABEL, type DeviceEventResponse, type ProcessorContext } from "@/lib/domain/processor";
import { checkCommandPreconditions, COMMAND_PAYLOADS, commandCompletionMutations, COMMAND_LABELS, CommandRejectedError } from "@/lib/domain/commands";
import { insert, remove, update, type Mutation, type PushMessage } from "@/lib/domain/mutations";
import { assertAdmin, assertCan, DEFAULT_NOTIFICATION_PREFS, PermissionError, ROLE_DEFAULT_PERMISSIONS } from "@/lib/domain/permissions";
import { describeDays, formatClock } from "@/lib/domain/quiet-hours";
import {
  expectedParcelInput,
  householdInput,
  inviteInput,
  memberUpdateInput,
  notificationPrefsInput,
  profileInput,
  quietHoursInput,
  deviceUpdateInput,
  type VisitorDecision,
} from "./schemas";
import { ServiceError, type DeviceGateway, type Store } from "./store";

export interface Actor {
  member: HouseholdMember;
  profile: Pick<Profile, "id" | "full_name">;
}

export interface ServiceHooks {
  /** Deliver push notifications (web push on the server, Notification API in demo). */
  onPush?: (messages: PushMessage[]) => void | Promise<void>;
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new ServiceError(r.error.issues[0]?.message ?? "Invalid input", 422);
  return r.data;
}

/**
 * The Dropin domain service. Every state change in the product goes through
 * here — in demo mode it runs in the browser against a local store, in
 * production it runs inside API routes against Supabase.
 */
export class DropinService {
  constructor(
    private store: Store,
    private gateway: DeviceGateway,
    private hooks: ServiceHooks = {},
  ) {}

  private now() {
    return new Date().toISOString();
  }

  // ─── Hardware events ──────────────────────────────────────────────────────

  async loadDeviceContext(deviceId: string): Promise<ProcessorContext> {
    const device = await this.store.get("devices", deviceId);
    if (!device) throw new ServiceError("Unknown device", 404);
    const [household, states, quiet, members, openParcels, visitors, pendingCommands] = await Promise.all([
      this.store.get("households", device.household_id),
      this.store.list("device_states", { device_id: device.id }),
      this.store.list("quiet_hours", { household_id: device.household_id }),
      this.store.list("household_members", { household_id: device.household_id }),
      this.store.list("parcels", { household_id: device.household_id, status: ["expected", "received"] }),
      this.store.list("visitors", { household_id: device.household_id }, { orderBy: "arrived_at", ascending: false, limit: 20 }),
      this.store.list("device_commands", { device_id: device.id, status: ["pending", "sent"] }),
    ]);
    if (!household) throw new ServiceError("Unknown household", 404);
    const state = states[0] ?? newDeviceState(device.id);
    if (!states[0]) await this.store.apply([insert("device_states", state)]);
    const cutoff = Date.now() - 15 * 60_000;
    return {
      household,
      device,
      state,
      quietHours: quiet[0] ?? null,
      members,
      openParcels,
      recentVisitors: visitors.filter((v) => new Date(v.arrived_at).getTime() >= cutoff),
      pendingCommands,
    };
  }

  /**
   * Ingest a normalized device event. Idempotent on `event_id`.
   * Returns what the device should do (e.g. whether to chime).
   */
  async ingestEvent(raw: unknown): Promise<DeviceEventResponse & { duplicate?: boolean }> {
    const event: DeviceEvent = parse(deviceEventSchema, raw);
    const existing = await this.store.list("device_events", { event_id: event.event_id }, { limit: 1 });
    if (existing.length) {
      return { event_id: event.event_id, chime: false, quiet_hours_active: false, duplicate: true };
    }
    const ctx = await this.loadDeviceContext(event.device_id);
    if (ctx.device.household_id !== event.household_id) throw new ServiceError("Device does not belong to this household", 403);

    const stored: StoredDeviceEvent = { ...event, processing_status: "received", error: null, received_at: this.now() };
    try {
      const result = processDeviceEvent(ctx, event);
      await this.store.apply([insert("device_events", { ...stored, processing_status: "processed" }), ...result.mutations]);
      if (result.push.length) await this.hooks.onPush?.(result.push);
      for (const id of result.dispatchCommandIds) {
        const cmd = ctx.pendingCommands.find((c) => c.id === id);
        if (cmd) await this.dispatch(cmd, { ...ctx.device, connection_status: "online" });
      }
      return result.response;
    } catch (err) {
      await this.store.apply([insert("device_events", { ...stored, processing_status: "failed", error: err instanceof Error ? err.message : "error" })]);
      throw err;
    }
  }

  // ─── Device commands ──────────────────────────────────────────────────────

  private async dispatch(command: DeviceCommand, device: Device): Promise<DeviceCommand> {
    const outcome = await this.gateway.dispatch(command, device);
    const at = this.now();
    if (outcome.status === "completed") {
      const [states, quiet] = await Promise.all([this.store.list("device_states", { device_id: device.id }), this.store.list("quiet_hours", { household_id: device.household_id })]);
      await this.store.apply(commandCompletionMutations(command, { device, state: states[0], quietHours: quiet[0] }, at));
      return { ...command, status: "completed", completed_at: at };
    }
    if (outcome.status === "failed") {
      await this.store.apply([update("device_commands", command.id, { status: "failed", error: outcome.error, completed_at: at })]);
      return { ...command, status: "failed", error: outcome.error };
    }
    if (outcome.status === "sent") {
      await this.store.apply([update("device_commands", command.id, { status: "sent" })]);
      return { ...command, status: "sent" };
    }
    return command;
  }

  async issueCommand(actor: Actor, input: { device_id: string; command_type: DeviceCommandType; payload?: Record<string, unknown> }): Promise<DeviceCommand> {
    const device = await this.requireDevice(actor, input.device_id);
    const type = input.command_type;
    if (type === "unlock_compartment" || type === "lock_compartment") assertCan(actor.member, "can_unlock");
    else if (type === "grant_access" || type === "deny_access") assertCan(actor.member, "can_manage_access");
    else assertCan(actor.member, "can_manage_device");

    const payload = parse(COMMAND_PAYLOADS[type], input.payload ?? {}) as Record<string, unknown>;
    const [state] = await this.store.list("device_states", { device_id: device.id });
    checkCommandPreconditions(device, state, type);

    const command: DeviceCommand = {
      id: uid(),
      device_id: device.id,
      household_id: device.household_id,
      command_type: type,
      payload,
      status: "pending",
      error: null,
      issued_by: actor.profile.id,
      created_at: this.now(),
      completed_at: null,
    };
    const audit: Mutation[] = [];
    if (type === "unlock_compartment" || type === "lock_compartment" || type === "restart_device") {
      audit.push(
        insert("activities", {
          id: uid(),
          household_id: device.household_id,
          device_id: device.id,
          event_type: "command",
          category: type === "restart_device" ? "device" : "security",
          title: COMMAND_LABELS[type],
          description: `Requested by ${actor.profile.full_name}.`,
          metadata: { command_id: command.id, command_type: type },
          actor_id: actor.profile.id,
          created_at: command.created_at,
        }),
      );
    }
    await this.store.apply([insert("device_commands", command), ...audit]);
    if (device.connection_status !== "online") return command; // queued until reconnect
    return this.dispatch(command, device);
  }

  /** Called by the device-gateway when firmware confirms or rejects a command. */
  async acknowledgeCommand(deviceId: string, commandId: string, result: { success: boolean; error?: string }): Promise<DeviceCommand> {
    const command = await this.store.get("device_commands", commandId);
    if (!command || command.device_id !== deviceId) throw new ServiceError("Unknown command", 404);
    if (command.status === "completed" || command.status === "failed") return command;
    const at = this.now();
    if (!result.success) {
      await this.store.apply([update("device_commands", command.id, { status: "failed", error: result.error ?? "Device rejected the command", completed_at: at })]);
      return { ...command, status: "failed" };
    }
    const device = await this.store.get("devices", deviceId);
    if (!device) throw new ServiceError("Unknown device", 404);
    const [states, quiet] = await Promise.all([this.store.list("device_states", { device_id: deviceId }), this.store.list("quiet_hours", { household_id: device.household_id })]);
    await this.store.apply([...commandCompletionMutations(command, { device, state: states[0], quietHours: quiet[0] }, at), update("devices", deviceId, { last_seen_at: at })]);
    return { ...command, status: "completed", completed_at: at };
  }

  // ─── Visitors ─────────────────────────────────────────────────────────────

  async respondToVisitor(actor: Actor, visitorId: string, decision: VisitorDecision): Promise<{ visitor: Visitor; command: DeviceCommand | null }> {
    const visitor = await this.store.get("visitors", visitorId);
    if (!visitor || visitor.household_id !== actor.member.household_id) throw new ServiceError("Visitor not found", 404);
    const at = this.now();
    const finalStates: Visitor["status"][] = ["approved", "denied", "declined", "ended"];

    if (decision === "answer") {
      assertCan(actor.member, "can_view_camera");
      if (finalStates.includes(visitor.status)) throw new ServiceError("This visit has already ended.", 409);
      await this.store.apply([update("visitors", visitorId, { status: "answered", responded_at: at, responded_by: actor.profile.id })]);
      return { visitor: { ...visitor, status: "answered" }, command: null };
    }
    if (decision === "decline" || decision === "end") {
      const status = decision === "decline" ? "declined" : visitor.status === "approved" || visitor.status === "denied" ? visitor.status : "ended";
      await this.store.apply([update("visitors", visitorId, { status, responded_at: visitor.responded_at ?? at, responded_by: visitor.responded_by ?? actor.profile.id })]);
      return { visitor: { ...visitor, status }, command: null };
    }

    // approve / deny — security decisions, always audited
    assertCan(actor.member, "can_manage_access");
    if (visitor.status === "approved" || visitor.status === "denied") throw new ServiceError(`Already ${visitor.status}.`, 409);
    if (!visitor.device_id) throw new ServiceError("No device is linked to this visit.", 409);
    const approve = decision === "approve";
    // The device must accept the decision before we record it as granted.
    const command = await this.issueCommand(actor, {
      device_id: visitor.device_id,
      command_type: approve ? "grant_access" : "deny_access",
      payload: { visitor_id: visitor.id, request_type: visitor.request_type },
    });
    if (command.status === "failed") throw new ServiceError(command.error ?? "The device rejected the request.", 502);
    const status: Visitor["status"] = approve ? "approved" : "denied";
    const confirmed = command.status === "completed";
    await this.store.apply([
      update("visitors", visitorId, { status, responded_at: at, responded_by: actor.profile.id }),
      insert("activities", {
        id: uid(),
        household_id: visitor.household_id,
        device_id: visitor.device_id,
        event_type: approve ? "access_granted" : "access_denied",
        category: "security",
        title: approve ? "Access granted" : "Access denied",
        description: `${actor.profile.full_name} ${approve ? "approved" : "denied"} a request to ${REQUEST_LABEL[visitor.request_type].toLowerCase()}.${confirmed ? "" : " Waiting for the device to confirm."}`,
        metadata: { visitor_id: visitor.id, command_id: command.id, via: "app" },
        actor_id: actor.profile.id,
        created_at: at,
      }),
    ]);
    return { visitor: { ...visitor, status }, command };
  }

  // ─── Parcels ──────────────────────────────────────────────────────────────

  async addExpectedParcel(actor: Actor, input: unknown): Promise<Parcel> {
    const data = parse(expectedParcelInput, input);
    const at = this.now();
    const parcel: Parcel = {
      id: uid(),
      household_id: actor.member.household_id,
      device_id: null,
      courier_name: data.courier_name,
      sender: data.sender ?? null,
      tracking_number: data.tracking_number ?? null,
      weight_kg: data.weight_kg ?? null,
      image_url: null,
      status: "expected",
      source: "manual",
      expected_at: data.expected_at ?? null,
      deposited_at: null,
      collected_at: null,
      collected_by: null,
      created_at: at,
    };
    await this.store.apply([
      insert("parcels", parcel),
      insert("activities", {
        id: uid(),
        household_id: parcel.household_id,
        device_id: null,
        event_type: "parcel_expected",
        category: "parcels",
        title: "Parcel expected",
        description: `${actor.profile.full_name} added a ${parcel.courier_name} delivery.`,
        metadata: { parcel_id: parcel.id },
        actor_id: actor.profile.id,
        created_at: at,
      }),
    ]);
    return parcel;
  }

  async deleteExpectedParcel(actor: Actor, parcelId: string): Promise<void> {
    const parcel = await this.store.get("parcels", parcelId);
    if (!parcel || parcel.household_id !== actor.member.household_id) throw new ServiceError("Parcel not found", 404);
    if (parcel.status !== "expected") throw new ServiceError("Only expected parcels can be removed. Delivered parcels stay in your history.", 409);
    await this.store.apply([remove("parcels", parcelId)]);
  }

  /**
   * Manual fallback for when the compartment sensor couldn't attribute a
   * collection (e.g. two parcels, one taken). Updates the record only — the
   * compartment state still comes from the device sensor.
   */
  async markParcelCollected(actor: Actor, parcelId: string): Promise<Parcel> {
    const parcel = await this.store.get("parcels", parcelId);
    if (!parcel || parcel.household_id !== actor.member.household_id) throw new ServiceError("Parcel not found", 404);
    if (parcel.status !== "received") throw new ServiceError("Only parcels in the compartment can be collected.", 409);
    const at = this.now();
    const muts: Mutation[] = [
      update("parcels", parcelId, { status: "collected", collected_at: at, collected_by: actor.profile.id }),
      insert("activities", {
        id: uid(),
        household_id: parcel.household_id,
        device_id: parcel.device_id,
        event_type: "parcel_collected",
        category: "parcels",
        title: "Parcel collected",
        description: `${actor.profile.full_name} marked the ${parcel.courier_name ?? "unidentified"} parcel as collected.`,
        metadata: { parcel_id: parcel.id, manual: true },
        actor_id: actor.profile.id,
        created_at: at,
      }),
    ];
    // Simulated hardware has no real weight sensor; mimic one so demo state stays coherent.
    if (parcel.device_id) {
      const device = await this.store.get("devices", parcel.device_id);
      if (device?.is_simulated) {
        const stillInside = (await this.store.list("parcels", { household_id: parcel.household_id, status: "received" })).filter((p) => p.id !== parcelId);
        const [state] = await this.store.list("device_states", { device_id: device.id });
        if (!stillInside.length && state) muts.push(update("device_states", state.id, { compartment_status: "empty", last_deposit_at: null, updated_at: at }));
      }
    }
    await this.store.apply(muts);
    return { ...parcel, status: "collected", collected_at: at };
  }

  // ─── Quiet hours ──────────────────────────────────────────────────────────

  /**
   * Quiet hours are stored server-side and enforced in `processDeviceEvent`
   * (the backend tells the doorbell not to chime). The schedule is also pushed
   * to the device so it can enforce it if it loses its connection.
   */
  async updateQuietHours(actor: Actor, input: unknown): Promise<{ quietHours: QuietHours; synced: boolean; command: DeviceCommand | null }> {
    assertAdmin(actor.member);
    const data = parse(quietHoursInput, input);
    const hid = actor.member.household_id;
    const [existing] = await this.store.list("quiet_hours", { household_id: hid });
    const at = this.now();
    const row: QuietHours = {
      id: existing?.id ?? uid(),
      household_id: hid,
      ...data,
      days_of_week: [...new Set(data.days_of_week)].sort(),
      updated_at: at,
      updated_by: actor.profile.id,
      synced_at: null,
    };
    await this.store.apply([
      existing ? update("quiet_hours", row.id, row) : insert("quiet_hours", row),
      insert("activities", {
        id: uid(),
        household_id: hid,
        device_id: null,
        event_type: "quiet_hours_changed",
        category: "security",
        title: row.enabled ? "Quiet hours updated" : "Quiet hours turned off",
        description: row.enabled ? `${formatClock(row.start_time)} – ${formatClock(row.end_time)}, ${describeDays(row.days_of_week).toLowerCase()}. Set by ${actor.profile.full_name}.` : `Turned off by ${actor.profile.full_name}.`,
        metadata: { ...data },
        actor_id: actor.profile.id,
        created_at: at,
      }),
    ]);

    // Push to every doorbell-capable device in the household.
    const devices = await this.store.list("devices", { household_id: hid });
    let lastCommand: DeviceCommand | null = null;
    let synced = devices.length > 0;
    for (const d of devices) {
      const command: DeviceCommand = {
        id: uid(),
        device_id: d.id,
        household_id: hid,
        command_type: "set_quiet_hours",
        payload: { enabled: row.enabled, start_time: row.start_time, end_time: row.end_time, days_of_week: row.days_of_week, timezone: row.timezone },
        status: "pending",
        error: null,
        issued_by: actor.profile.id,
        created_at: at,
        completed_at: null,
      };
      // Supersede older unsent schedule commands.
      const stale = await this.store.list("device_commands", { device_id: d.id, command_type: "set_quiet_hours", status: ["pending", "sent"] });
      await this.store.apply([...stale.map((c) => update("device_commands", c.id, { status: "expired", error: "Superseded by a newer schedule", completed_at: at })), insert("device_commands", command)]);
      lastCommand = d.connection_status === "online" ? await this.dispatch(command, d) : command;
      if (lastCommand.status !== "completed") synced = false;
    }
    return { quietHours: { ...row, synced_at: synced ? this.now() : null }, synced, command: lastCommand };
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  async markNotificationsRead(actor: Actor, ids: string[] | "all"): Promise<number> {
    const mine = await this.store.list("notifications", { user_id: actor.profile.id, household_id: actor.member.household_id });
    const targets = mine.filter((n) => !n.read_at && (ids === "all" || ids.includes(n.id)));
    const at = this.now();
    await this.store.apply(targets.map((n) => update("notifications", n.id, { read_at: at })));
    return targets.length;
  }

  async updateNotificationPrefs(actor: Actor, input: unknown): Promise<NotificationPrefs> {
    const prefs = parse(notificationPrefsInput, input);
    await this.store.apply([update("household_members", actor.member.id, { notification_prefs: prefs })]);
    return prefs;
  }

  // ─── Account & household ──────────────────────────────────────────────────

  async updateProfile(actor: Actor, input: unknown): Promise<void> {
    const data = parse(profileInput, input);
    await this.store.apply([update("profiles", actor.profile.id, { full_name: data.full_name, phone: data.phone ?? null, ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}) })]);
  }

  async updateHousehold(actor: Actor, input: unknown): Promise<void> {
    assertAdmin(actor.member);
    const data = parse(householdInput, input);
    await this.store.apply([update("households", actor.member.household_id, data)]);
  }

  async inviteMember(actor: Actor, input: unknown) {
    assertAdmin(actor.member);
    const data = parse(inviteInput, input);
    const hid = actor.member.household_id;
    const [pending, members] = await Promise.all([this.store.list("household_invitations", { household_id: hid, status: "pending" }), this.store.list("household_members", { household_id: hid })]);
    if (pending.some((i) => i.email === data.email)) throw new ServiceError("That person already has a pending invitation.", 409);
    if (members.some((m) => m.profile?.email?.toLowerCase() === data.email)) throw new ServiceError("That person is already a member.", 409);
    const at = this.now();
    const invitation = { id: uid(), household_id: hid, email: data.email, role: data.role, status: "pending" as const, invited_by: actor.profile.id, created_at: at };
    await this.store.apply([
      insert("household_invitations", invitation),
      insert("activities", { id: uid(), household_id: hid, device_id: null, event_type: "member_invited", category: "security", title: "Resident invited", description: `${actor.profile.full_name} invited ${data.email} as ${data.role}.`, metadata: { email: data.email }, actor_id: actor.profile.id, created_at: at }),
    ]);
    return invitation;
  }

  async revokeInvitation(actor: Actor, invitationId: string) {
    assertAdmin(actor.member);
    const inv = await this.store.get("household_invitations", invitationId);
    if (!inv || inv.household_id !== actor.member.household_id) throw new ServiceError("Invitation not found", 404);
    await this.store.apply([update("household_invitations", inv.id, { status: "revoked" })]);
  }

  async updateMember(actor: Actor, memberId: string, input: unknown) {
    assertAdmin(actor.member);
    const data = parse(memberUpdateInput, input);
    const member = await this.store.get("household_members", memberId);
    if (!member || member.household_id !== actor.member.household_id) throw new ServiceError("Member not found", 404);
    if (member.role === "owner") throw new PermissionError("The owner's access can't be changed.");
    const values: Partial<HouseholdMember> = {};
    if (data.role) values.role = data.role;
    if (data.permissions) values.permissions = data.permissions;
    else if (data.role) values.permissions = ROLE_DEFAULT_PERMISSIONS[data.role];
    await this.store.apply([update("household_members", memberId, values)]);
  }

  async removeMember(actor: Actor, memberId: string) {
    const member = await this.store.get("household_members", memberId);
    if (!member || member.household_id !== actor.member.household_id) throw new ServiceError("Member not found", 404);
    const self = member.id === actor.member.id;
    if (!self) assertAdmin(actor.member);
    if (member.role === "owner") throw new PermissionError("The owner can't be removed. Transfer ownership first.");
    const at = this.now();
    await this.store.apply([
      remove("household_members", memberId),
      insert("activities", { id: uid(), household_id: member.household_id, device_id: null, event_type: "member_removed", category: "security", title: self ? "Resident left" : "Access revoked", description: `${member.profile?.full_name ?? "A resident"} no longer has access.`, metadata: { member_id: memberId }, actor_id: actor.profile.id, created_at: at }),
    ]);
  }

  // ─── Devices ──────────────────────────────────────────────────────────────

  private async requireDevice(actor: Actor, deviceId: string): Promise<Device> {
    const device = await this.store.get("devices", deviceId);
    if (!device || device.household_id !== actor.member.household_id) throw new ServiceError("Device not found", 404);
    return device;
  }

  async renameDevice(actor: Actor, deviceId: string, input: unknown) {
    assertCan(actor.member, "can_manage_device");
    await this.requireDevice(actor, deviceId);
    const data = parse(deviceUpdateInput, input);
    await this.store.apply([update("devices", deviceId, data)]);
  }

  async removeDevice(actor: Actor, deviceId: string) {
    assertAdmin(actor.member);
    const device = await this.requireDevice(actor, deviceId);
    const at = this.now();
    await this.store.apply([
      remove("devices", deviceId),
      insert("activities", { id: uid(), household_id: device.household_id, device_id: null, event_type: "device_offline", category: "device", title: "Device removed", description: `${actor.profile.full_name} removed ${device.device_name} (${device.device_identifier}).`, metadata: { device_identifier: device.device_identifier }, actor_id: actor.profile.id, created_at: at }),
    ]);
  }
}

export function newDeviceState(deviceId: string): DeviceState {
  return {
    id: uid(),
    device_id: deviceId,
    compartment_status: "empty",
    door_status: "closed",
    lock_status: "locked",
    camera_status: "ready",
    door_opened_at: null,
    last_deposit_at: null,
    updated_at: new Date().toISOString(),
  };
}

export function newMembership(householdId: string, userId: string, role: HouseholdMember["role"]): HouseholdMember {
  return {
    id: uid(),
    household_id: householdId,
    user_id: userId,
    role,
    permissions: ROLE_DEFAULT_PERMISSIONS[role],
    notification_prefs: DEFAULT_NOTIFICATION_PREFS,
    created_at: new Date().toISOString(),
  };
}

export { CommandRejectedError, PermissionError };
export type { Activity };
