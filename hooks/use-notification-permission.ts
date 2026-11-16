"use client";

import { useState, useSyncExternalStore } from "react";
import { notificationPermission, requestNotificationPermission, type PermissionState } from "@/lib/push/browser";

/** Notification permission, with a request function that updates it. */
export function useNotificationPermission() {
  const current = useSyncExternalStore(
    () => () => {},
    () => notificationPermission(),
    () => "unsupported" as PermissionState,
  );
  const [override, setOverride] = useState<PermissionState | null>(null);
  const request = async () => {
    const p = await requestNotificationPermission();
    setOverride(p);
    return p;
  };
  return { permission: override ?? current, request };
}
