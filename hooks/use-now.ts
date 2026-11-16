"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time, re-rendering every `intervalMs`. Returns null during SSR and
 * hydration so server and client markup match.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const t = useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, intervalMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
  return t === null ? null : new Date(t);
}
