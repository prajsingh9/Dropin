"use client";

/**
 * Browser notification helpers. Structured so native push (APNs/FCM via a
 * Capacitor/React Native shell) can implement the same three functions.
 */
export type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationPermission();
  }
}

/** Shows a system notification while the app is open (demo mode, or no server push configured). */
export async function showLocalNotification(n: { title: string; body: string; url?: string | null; tag: string; silent: boolean }) {
  if (notificationPermission() !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = { body: n.body, tag: n.tag, silent: n.silent, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", data: { url: n.url ?? "/home" } };
  if (reg) await reg.showNotification(n.title, options);
  else new Notification(n.title, options);
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Registers for server-sent web push. Returns null if unsupported or not configured. */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON | null> {
  if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  return sub.toJSON();
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}
