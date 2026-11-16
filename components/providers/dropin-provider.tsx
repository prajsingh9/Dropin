"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, DoorOpen, Package, ShieldAlert, Wifi } from "lucide-react";
import type { DeviceState, Device, HouseholdSnapshot, Visitor } from "@/types/dropin";
import type { DropinClient } from "@/lib/client/types";
import { DemoClient } from "@/lib/client/demo-client";
import { SupabaseDropinClient } from "@/lib/client/supabase-client";
import { isSupabaseConfigured, vapidPublicKey } from "@/lib/config";
import { showLocalNotification } from "@/lib/push/browser";
import type { PushMessage } from "@/lib/domain/mutations";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/domain/permissions";
import { useToast } from "@/components/ui/toast";

export type AppStatus = "loading" | "signed_out" | "needs_onboarding" | "ready" | "error";

interface DropinContextValue {
  client: DropinClient;
  mode: "demo" | "supabase";
  status: AppStatus;
  error: string | null;
  snapshot: HouseholdSnapshot | null;
  device: Device | undefined;
  deviceState: DeviceState | undefined;
  unreadCount: number;
  incomingVisitor: Visitor | null;
  dismissIncoming: (id: string) => void;
  refresh: () => Promise<void>;
  /** Runs a client action and refreshes the snapshot afterwards. */
  run: <T>(fn: (c: DropinClient) => Promise<T>) => Promise<T>;
}

const DropinContext = createContext<DropinContextValue | null>(null);

const RING_WINDOW_MS = 90_000;

const KIND_ICON: Record<string, ReactNode> = {
  parcels: <Package className="size-5" />,
  visitors: <Bell className="size-5" />,
  security: <ShieldAlert className="size-5" />,
  device: <Wifi className="size-5" />,
};

export function DropinProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const snapshotRef = useRef<HouseholdSnapshot | null>(null);

  const [client] = useState<DropinClient>(() => (isSupabaseConfigured ? new SupabaseDropinClient() : new DemoClient()));

  // Demo mode delivers "push" via the Notification API while the app is in the background.
  useEffect(() => {
    if (!(client instanceof DemoClient)) return;
    client.setPushHandler((messages: PushMessage[]) => {
      const snap = snapshotRef.current;
      if (!snap || document.visibilityState === "visible") return;
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...snap.membership.notification_prefs };
      if (!prefs.browser_push) return;
      for (const m of messages) if (m.user_id === snap.user.id) void showLocalNotification(m);
    });
    return () => client.setPushHandler(null);
  }, [client]);
  const [status, setStatus] = useState<AppStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<HouseholdSnapshot | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const seenNotifications = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await client.getSession();
      if (!session) {
        snapshotRef.current = null;
        setSnapshot(null);
        setStatus("signed_out");
        return;
      }
      const snap = await client.loadSnapshot();
      snapshotRef.current = snap;
      setSnapshot(snap);
      setStatus(snap ? "ready" : "needs_onboarding");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your home.");
      setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, [client]);

  useEffect(() => {
    // Initial load from the backend (an external system); state is set after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Realtime (Supabase) or cross-tab/local events (demo).
  const hid = snapshot?.household.id;
  const userId = snapshot?.user.id;
  useEffect(() => {
    if (!hid || !userId) {
      if (client.mode === "demo") return client.subscribe("", "", () => void refresh());
      return;
    }
    return client.subscribe(hid, userId, () => void refresh());
  }, [client, hid, userId, refresh]);

  // Refetch when the app comes back to the foreground (mobile).
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  // Clock for time-based UI (ringing window, "just arrived").
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // In-app banner for notifications that arrive while the app is open.
  useEffect(() => {
    if (!snapshot) return;
    const ids = new Set(snapshot.notifications.map((n) => n.id));
    if (seenNotifications.current) {
      const fresh = snapshot.notifications.filter((n) => !seenNotifications.current!.has(n.id) && !n.read_at && Date.now() - new Date(n.created_at).getTime() < 120_000);
      for (const n of fresh.slice(0, 2).reverse()) {
        if (n.event_type === "doorbell_pressed") continue; // the incoming-call sheet handles this
        toast.push({ tone: "event", title: n.title, description: n.description, href: n.action_url ?? undefined, icon: n.event_type === "compartment_left_open" ? <DoorOpen className="size-5" /> : KIND_ICON[n.category] });
      }
    }
    seenNotifications.current = ids;
  }, [snapshot, toast]);

  // Register for server web push when the user enabled it (production only).
  const browserPush = snapshot?.membership.notification_prefs?.browser_push;
  useEffect(() => {
    if (client.mode !== "supabase" || !browserPush || !vapidPublicKey || !client.savePushSubscription) return;
    void import("@/lib/push/browser").then(async ({ subscribeToPush, notificationPermission }) => {
      if (notificationPermission() !== "granted") return;
      const sub = await subscribeToPush(vapidPublicKey).catch(() => null);
      if (sub) await client.savePushSubscription!(sub).catch(() => {});
    });
  }, [client, browserPush]);

  const run = useCallback(
    async <T,>(fn: (c: DropinClient) => Promise<T>) => {
      try {
        return await fn(client);
      } finally {
        await refresh();
      }
    },
    [client, refresh],
  );

  const value = useMemo<DropinContextValue>(() => {
    const device = snapshot?.devices[0];
    const incoming =
      snapshot?.visitors.find((v) => v.status === "ringing" && now - new Date(v.arrived_at).getTime() < RING_WINDOW_MS && !dismissed.has(v.id)) ?? null;
    return {
      client,
      mode: client.mode,
      status,
      error,
      snapshot,
      device,
      deviceState: device ? snapshot?.deviceStates[device.id] : undefined,
      unreadCount: snapshot?.notifications.filter((n) => !n.read_at).length ?? 0,
      incomingVisitor: incoming,
      dismissIncoming: (id) => setDismissed((s) => new Set(s).add(id)),
      refresh,
      run,
    };
  }, [client, status, error, snapshot, now, dismissed, refresh, run]);

  return <DropinContext.Provider value={value}>{children}</DropinContext.Provider>;
}

export function useDropin() {
  const ctx = useContext(DropinContext);
  if (!ctx) throw new Error("useDropin must be used inside DropinProvider");
  return ctx;
}

/** For screens inside the authenticated shell, where the snapshot is guaranteed. */
export function useHousehold() {
  const ctx = useDropin();
  if (!ctx.snapshot) throw new Error("useHousehold used before the household loaded");
  return { ...ctx, snapshot: ctx.snapshot };
}
