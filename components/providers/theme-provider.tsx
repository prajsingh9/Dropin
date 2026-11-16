"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";
const KEY = "dropin.theme";

/** Inline script that applies the theme before first paint (no flash). */
export const themeScript = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

// A tiny external store over localStorage + the OS colour scheme.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  mq.addEventListener("change", cb);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
    window.removeEventListener("storage", onStorage);
  };
}
function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const Ctx = createContext<{ preference: ThemePreference; resolved: "light" | "dark"; setPreference: (p: ThemePreference) => void }>({
  preference: "system",
  resolved: "light",
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);
  const dark = useSyncExternalStore(subscribe, systemDark, () => false);
  const resolved: "light" | "dark" = preference === "dark" || (preference === "system" && dark) ? "dark" : "light";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0C0C0B" : "#F4F1EB");
  }, [resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {}
    listeners.forEach((l) => l());
  }, []);

  return <Ctx.Provider value={{ preference, resolved, setPreference }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
