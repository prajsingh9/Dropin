"use client";

import type { HouseholdSnapshot, QuietHours } from "@/types/dropin";
import { applyToTables, matchesFilter, ServiceError, type Filter, type ListOptions, type Store } from "@/lib/backend/store";
import { DropinService, newDeviceState, newMembership, type Actor } from "@/lib/backend/service";
import { onboardingInput, type OnboardingInput } from "@/lib/backend/schemas";
import type { Mutation, PushMessage, TableName, TableRows } from "@/lib/domain/mutations";
import { SimulatedGateway } from "@/lib/hardware/gateway";
import { buildSimulatedEvent } from "@/lib/simulation/scenarios";
import { browserTimeZone, createSampleTables, emptyTables, type DemoIdentity, type DemoTables } from "@/lib/demo/seed";
import { uid } from "@/lib/utils";
import type { ClientSession, DropinClient } from "./types";

const DB_KEY = "dropin.demo.db.v1";
const SESSION_KEY = "dropin.demo.session.v1";
const CHANNEL = "dropin-demo";

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — demo keeps working in memory */
  }
}

/** In-browser implementation of the `Store` port. */
class LocalStore implements Store {
  constructor(
    public tables: DemoTables,
    private onWrite: () => void,
  ) {}

  async get<T extends TableName>(table: T, id: string) {
    const pk = table === "device_events" ? "event_id" : "id";
    const row = (this.tables[table] as unknown as Record<string, unknown>[]).find((r) => r[pk] === id);
    return (row ? structuredClone(row) : null) as TableRows[T] | null;
  }

  async list<T extends TableName>(table: T, filter: Filter<TableRows[T]>, options: ListOptions<TableRows[T]> = {}) {
    let rows = (this.tables[table] as TableRows[T][]).filter((r) => matchesFilter(r, filter));
    if (options.orderBy) {
      const k = options.orderBy;
      rows = [...rows].sort((a, b) => String(a[k] ?? "").localeCompare(String(b[k] ?? "")) * (options.ascending === false ? -1 : 1));
    }
    if (options.limit) rows = rows.slice(0, options.limit);
    return structuredClone(rows);
  }

  async apply(mutations: Mutation[]) {
    if (!mutations.length) return;
    applyToTables(this.tables, mutations);
    // Keep the embedded member profile in sync, as a SQL join would.
    for (const m of mutations) {
      if (m.table === "profiles" && m.kind === "update") {
        const p = this.tables.profiles.find((x) => x.id === m.id);
        for (const mem of this.tables.household_members) if (p && mem.user_id === p.id) mem.profile = { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url };
      }
    }
    this.onWrite();
  }
}

/**
 * Demo mode: a complete Dropin backend that runs in the browser. The same
 * `DropinService` and event processor as production; data persists in
 * localStorage and syncs between tabs.
 */
export class DemoClient implements DropinClient {
  mode = "demo" as const;
  private store: LocalStore;
  private service: DropinService;
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;

  private onPush: ((messages: PushMessage[]) => void) | null = null;

  constructor() {
    const tables = readJSON<DemoTables>(DB_KEY) ?? emptyTables();
    this.store = new LocalStore({ ...emptyTables(), ...tables }, () => this.persist());
    this.service = new DropinService(this.store, new SimulatedGateway(700), { onPush: (m) => this.onPush?.(m) });
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = () => {
        const fresh = readJSON<DemoTables>(DB_KEY);
        if (fresh) this.store.tables = { ...emptyTables(), ...fresh };
        this.emit();
      };
    }
  }

  /** Where to deliver push messages produced by the domain service (Notification API in demo mode). */
  setPushHandler(fn: ((messages: PushMessage[]) => void) | null) {
    this.onPush = fn;
  }

  private persist() {
    writeJSON(DB_KEY, this.store.tables);
    this.channel?.postMessage("changed");
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private session(): ClientSession | null {
    return readJSON<ClientSession>(SESSION_KEY);
  }

  async getSession() {
    const s = this.session();
    if (!s) return null;
    // Session refers to a user that no longer exists (e.g. storage cleared).
    if (!this.store.tables.profiles.some((p) => p.id === s.userId)) return null;
    return s;
  }

  /** Demo sign-in. `withSample` loads a lived-in household; otherwise the user goes through onboarding. */
  async signIn(identity: DemoIdentity, withSample: boolean) {
    if (withSample) {
      const { tables, userId } = createSampleTables(identity);
      this.store.tables = tables;
      writeJSON(SESSION_KEY, { userId, email: identity.email });
    } else {
      const tables = emptyTables();
      const userId = uid();
      tables.profiles.push({ id: userId, full_name: identity.full_name, email: identity.email, phone: identity.phone ?? null, avatar_url: null, created_at: new Date().toISOString() });
      this.store.tables = tables;
      writeJSON(SESSION_KEY, { userId, email: identity.email });
    }
    this.persist();
  }

  async signOut() {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(DB_KEY);
    } catch {}
    this.store.tables = emptyTables();
    this.channel?.postMessage("changed");
    this.emit();
  }

  async loadSnapshot(): Promise<HouseholdSnapshot | null> {
    const s = this.session();
    if (!s) return null;
    const t = this.store.tables;
    const user = t.profiles.find((p) => p.id === s.userId);
    const membership = t.household_members.find((m) => m.user_id === s.userId);
    if (!user || !membership) return null;
    const household = t.households.find((h) => h.id === membership.household_id);
    if (!household) return null;
    const hid = household.id;
    const devices = t.devices.filter((d) => d.household_id === hid);
    const deviceStates = Object.fromEntries(t.device_states.filter((st) => devices.some((d) => d.id === st.device_id)).map((st) => [st.device_id, st]));
    const byDate = <T,>(k: keyof T) => (a: T, b: T) => String(b[k]).localeCompare(String(a[k]));
    return structuredClone({
      user,
      household,
      membership,
      members: t.household_members.filter((m) => m.household_id === hid),
      invitations: t.household_invitations.filter((i) => i.household_id === hid && i.status === "pending"),
      devices,
      deviceStates,
      parcels: t.parcels.filter((p) => p.household_id === hid).sort(byDate("created_at")),
      visitors: t.visitors.filter((v) => v.household_id === hid).sort(byDate("arrived_at")),
      activities: t.activities.filter((a) => a.household_id === hid).sort(byDate("created_at")).slice(0, 300),
      notifications: t.notifications.filter((n) => n.household_id === hid && n.user_id === s.userId).sort(byDate("created_at")).slice(0, 200),
      quietHours: t.quiet_hours.find((q) => q.household_id === hid) ?? null,
      commands: t.device_commands.filter((c) => c.household_id === hid).sort(byDate("created_at")).slice(0, 50),
    });
  }

  subscribe(_householdId: string, _userId: string, onChange: () => void) {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  }

  private async actor(): Promise<Actor> {
    const snap = await this.loadSnapshot();
    if (!snap) throw new ServiceError("Not signed in", 401);
    return { member: snap.membership, profile: snap.user };
  }

  async completeOnboarding(input: OnboardingInput) {
    const data = onboardingInput.parse(input);
    const s = this.session();
    if (!s) throw new ServiceError("Not signed in", 401);
    const now = new Date().toISOString();
    const t = this.store.tables;
    if (t.devices.some((d) => d.device_identifier === data.device.device_identifier)) {
      throw new ServiceError("That device is already paired to a home.", 409);
    }
    const householdId = uid();
    const deviceId = uid();
    const simulated = data.device.simulated || data.device.device_identifier.startsWith("SIM-");
    const membership = newMembership(householdId, s.userId, "owner");
    const profile = t.profiles.find((p) => p.id === s.userId);
    membership.profile = { full_name: data.full_name, email: profile?.email ?? s.email, avatar_url: null };
    const quiet: QuietHours = { id: uid(), household_id: householdId, enabled: false, start_time: "00:00", end_time: "07:00", days_of_week: [0, 1, 2, 3, 4, 5, 6], timezone: data.household.timezone, updated_at: now, updated_by: s.userId, synced_at: null };
    const mutations: Mutation[] = [
      { kind: "update", table: "profiles", id: s.userId, values: { full_name: data.full_name, phone: data.phone || null } },
      { kind: "insert", table: "households", row: { id: householdId, created_at: now, ...data.household } },
      { kind: "insert", table: "household_members", row: membership },
      {
        kind: "insert",
        table: "devices",
        row: {
          id: deviceId,
          household_id: householdId,
          device_name: data.device.device_name,
          device_type: "parcel_collector",
          device_identifier: data.device.device_identifier,
          // Real hardware stays "pending" until it checks in with the backend — which can't happen in demo mode.
          connection_status: simulated ? "online" : "pending",
          firmware_version: simulated ? "1.4.2" : null,
          wifi_ssid: data.wifi_ssid ?? null,
          wifi_signal: simulated ? 78 : null,
          doorbell_volume: 70,
          doorbell_enabled: true,
          is_simulated: simulated,
          last_seen_at: simulated ? now : null,
          created_at: now,
        },
      },
      { kind: "insert", table: "device_states", row: newDeviceState(deviceId) },
      { kind: "insert", table: "quiet_hours", row: quiet },
      {
        kind: "insert",
        table: "activities",
        row: { id: uid(), household_id: householdId, device_id: deviceId, event_type: "device_online", category: "device", title: "Dropin paired", description: `${data.device.device_name} (${data.device.device_identifier}) was added to ${data.household.name}.`, metadata: { simulated }, actor_id: s.userId, created_at: now },
      },
    ];
    await this.store.apply(mutations);
  }

  issueCommand: DropinClient["issueCommand"] = async (deviceId, type, payload) => this.service.issueCommand(await this.actor(), { device_id: deviceId, command_type: type, payload });
  respondToVisitor: DropinClient["respondToVisitor"] = async (id, decision) => this.service.respondToVisitor(await this.actor(), id, decision);
  addExpectedParcel: DropinClient["addExpectedParcel"] = async (input) => this.service.addExpectedParcel(await this.actor(), input);
  deleteExpectedParcel: DropinClient["deleteExpectedParcel"] = async (id) => this.service.deleteExpectedParcel(await this.actor(), id);
  markParcelCollected: DropinClient["markParcelCollected"] = async (id) => {
    await this.service.markParcelCollected(await this.actor(), id);
  };
  updateQuietHours: DropinClient["updateQuietHours"] = async (input) => this.service.updateQuietHours(await this.actor(), input);
  markNotificationsRead: DropinClient["markNotificationsRead"] = async (ids) => {
    await this.service.markNotificationsRead(await this.actor(), ids);
  };
  updateNotificationPrefs: DropinClient["updateNotificationPrefs"] = async (prefs) => {
    await this.service.updateNotificationPrefs(await this.actor(), prefs);
  };
  updateProfile: DropinClient["updateProfile"] = async (input) => this.service.updateProfile(await this.actor(), input);
  updateHousehold: DropinClient["updateHousehold"] = async (input) => this.service.updateHousehold(await this.actor(), input);
  inviteMember: DropinClient["inviteMember"] = async (input) => {
    await this.service.inviteMember(await this.actor(), input);
  };
  revokeInvitation: DropinClient["revokeInvitation"] = async (id) => this.service.revokeInvitation(await this.actor(), id);
  updateMember: DropinClient["updateMember"] = async (id, input) => this.service.updateMember(await this.actor(), id, input);
  removeMember: DropinClient["removeMember"] = async (id) => this.service.removeMember(await this.actor(), id);
  renameDevice: DropinClient["renameDevice"] = async (id, name) => this.service.renameDevice(await this.actor(), id, { device_name: name });
  removeDevice: DropinClient["removeDevice"] = async (id) => this.service.removeDevice(await this.actor(), id);

  simulate: DropinClient["simulate"] = async (action, deviceId, snapshot) => {
    const device = snapshot.devices.find((d) => d.id === deviceId);
    if (!device?.is_simulated) throw new ServiceError("Only simulated devices can receive simulated events.", 403);
    return this.service.ingestEvent(buildSimulatedEvent(action, snapshot, deviceId));
  };
}

export { browserTimeZone };
