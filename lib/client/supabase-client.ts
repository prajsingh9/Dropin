"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Device, DeviceState, HouseholdMember, HouseholdSnapshot, Profile } from "@/types/dropin";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClientSession, DropinClient } from "./types";

const DEVICE_COLUMNS = "id, household_id, device_name, device_type, device_identifier, connection_status, firmware_version, wifi_ssid, wifi_signal, doorbell_volume, doorbell_enabled, is_simulated, last_seen_at, created_at";

async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/**
 * Production client. Reads go straight to Supabase under RLS; every write
 * goes through a validated API route; Realtime pushes changes.
 */
export class SupabaseDropinClient implements DropinClient {
  mode = "supabase" as const;
  private sb = getSupabaseBrowserClient();

  async getSession(): Promise<ClientSession | null> {
    const { data } = await this.sb.auth.getUser();
    return data.user ? { userId: data.user.id, email: data.user.email ?? "" } : null;
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async loadSnapshot(): Promise<HouseholdSnapshot | null> {
    const session = await this.getSession();
    if (!session) return null;
    const { data: membership, error: mErr } = await this.sb.from("household_members").select("*").eq("user_id", session.userId).order("created_at").limit(1).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!membership) return null;
    const hid = membership.household_id as string;

    const [user, household, members, invitations, devices, parcels, visitors, activities, notifications, quiet, commands] = await Promise.all([
      this.sb.from("profiles").select("*").eq("id", session.userId).single(),
      this.sb.from("households").select("*").eq("id", hid).single(),
      this.sb.from("household_members").select("*, profile:profiles(full_name, email, avatar_url)").eq("household_id", hid).order("created_at"),
      this.sb.from("household_invitations").select("*").eq("household_id", hid).eq("status", "pending"),
      this.sb.from("devices").select(DEVICE_COLUMNS).eq("household_id", hid).order("created_at"),
      this.sb.from("parcels").select("*").eq("household_id", hid).order("created_at", { ascending: false }).limit(200),
      this.sb.from("visitors").select("*").eq("household_id", hid).order("arrived_at", { ascending: false }).limit(100),
      this.sb.from("activities").select("*").eq("household_id", hid).order("created_at", { ascending: false }).limit(300),
      this.sb.from("notifications").select("*").eq("user_id", session.userId).eq("household_id", hid).order("created_at", { ascending: false }).limit(200),
      this.sb.from("quiet_hours").select("*").eq("household_id", hid).maybeSingle(),
      this.sb.from("device_commands").select("*").eq("household_id", hid).order("created_at", { ascending: false }).limit(50),
    ]);
    for (const r of [user, household, members, devices, parcels, activities, notifications]) if (r.error) throw new Error(r.error.message);

    const deviceRows = (devices.data ?? []) as unknown as Device[];
    const states = deviceRows.length ? await this.sb.from("device_states").select("*").in("device_id", deviceRows.map((d) => d.id)) : { data: [] as DeviceState[] };
    const num = (v: unknown) => (v == null ? null : Number(v));

    return {
      user: user.data as Profile,
      household: household.data,
      membership: membership as HouseholdMember,
      members: (members.data ?? []) as HouseholdMember[],
      invitations: invitations.data ?? [],
      devices: deviceRows,
      deviceStates: Object.fromEntries(((states.data ?? []) as DeviceState[]).map((s) => [s.device_id, s])),
      parcels: (parcels.data ?? []).map((p) => ({ ...p, weight_kg: num(p.weight_kg) })),
      // Members without camera permission get no visitor rows (RLS).
      visitors: visitors.data ?? [],
      activities: activities.data ?? [],
      notifications: notifications.data ?? [],
      quietHours: quiet.data ?? null,
      commands: commands.data ?? [],
    };
  }

  subscribe(householdId: string, userId: string, onChange: () => void) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onChange, 250);
    };
    const channel: RealtimeChannel = this.sb.channel(`household:${householdId}`);
    for (const table of ["parcels", "visitors", "activities", "devices", "device_states", "device_commands", "quiet_hours", "household_members", "household_invitations"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, bump);
    }
    channel.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, bump);
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void this.sb.removeChannel(channel);
    };
  }

  completeOnboarding: DropinClient["completeOnboarding"] = async (input) => {
    await api("/api/onboarding", "POST", input);
  };
  issueCommand: DropinClient["issueCommand"] = async (device_id, command_type, payload = {}) => (await api<{ command: Awaited<ReturnType<DropinClient["issueCommand"]>> }>("/api/commands", "POST", { device_id, command_type, payload })).command;
  respondToVisitor: DropinClient["respondToVisitor"] = (id, decision) => api(`/api/visitors/${id}/respond`, "POST", { decision });
  addExpectedParcel: DropinClient["addExpectedParcel"] = async (input) => (await api<{ parcel: Awaited<ReturnType<DropinClient["addExpectedParcel"]>> }>("/api/parcels", "POST", input)).parcel;
  deleteExpectedParcel: DropinClient["deleteExpectedParcel"] = async (id) => {
    await api(`/api/parcels/${id}`, "DELETE");
  };
  markParcelCollected: DropinClient["markParcelCollected"] = async (id) => {
    await api(`/api/parcels/${id}/collect`, "POST");
  };
  updateQuietHours: DropinClient["updateQuietHours"] = (input) => api("/api/quiet-hours", "PUT", input);
  markNotificationsRead: DropinClient["markNotificationsRead"] = async (ids) => {
    await api("/api/notifications/read", "POST", { ids });
  };
  updateNotificationPrefs: DropinClient["updateNotificationPrefs"] = async (prefs) => {
    await api("/api/notifications/preferences", "PUT", prefs);
  };
  updateProfile: DropinClient["updateProfile"] = async (input) => {
    await api("/api/profile", "PATCH", input);
  };
  updateHousehold: DropinClient["updateHousehold"] = async (input) => {
    await api("/api/household", "PATCH", input);
  };
  inviteMember: DropinClient["inviteMember"] = async (input) => {
    await api("/api/household/invitations", "POST", input);
  };
  revokeInvitation: DropinClient["revokeInvitation"] = async (id) => {
    await api(`/api/household/invitations/${id}`, "DELETE");
  };
  updateMember: DropinClient["updateMember"] = async (id, input) => {
    await api(`/api/household/members/${id}`, "PATCH", input);
  };
  removeMember: DropinClient["removeMember"] = async (id) => {
    await api(`/api/household/members/${id}`, "DELETE");
  };
  renameDevice: DropinClient["renameDevice"] = async (id, device_name) => {
    await api(`/api/devices/${id}`, "PATCH", { device_name });
  };
  removeDevice: DropinClient["removeDevice"] = async (id) => {
    await api(`/api/devices/${id}`, "DELETE");
  };
  simulate: DropinClient["simulate"] = (action, device_id) => api("/api/simulate", "POST", { action, device_id });
  savePushSubscription: NonNullable<DropinClient["savePushSubscription"]> = async (subscription) => {
    await api("/api/push/subscribe", "POST", { subscription });
  };
}
