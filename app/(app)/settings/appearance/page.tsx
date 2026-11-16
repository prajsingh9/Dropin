"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useTheme, type ThemePreference } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun; preview: string }[] = [
  { value: "light", label: "Light", icon: Sun, preview: "bg-[#F4F1EB]" },
  { value: "dark", label: "Dark", icon: Moon, preview: "bg-[#0C0C0B]" },
  { value: "system", label: "System", icon: Monitor, preview: "bg-[linear-gradient(135deg,#F4F1EB_50%,#0C0C0B_50%)]" },
];

export default function AppearancePage() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/settings" title="Appearance" />
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {OPTIONS.map(({ value, label, icon: Icon, preview }) => {
          const on = preference === value;
          return (
            <button key={value} role="radio" aria-checked={on} onClick={() => setPreference(value)} className={cn("rounded-card bg-surface p-3 text-left shadow-card ring-2 ring-inset transition", on ? "ring-accent" : "ring-transparent")}>
              <div className={cn("relative mb-3 aspect-[3/4] overflow-hidden rounded-[18px] ring-1 ring-line", preview)}>
                <div className="absolute inset-x-3 top-4 h-2 w-1/2 rounded-full bg-[#888]/50" />
                <div className="absolute inset-x-3 top-9 h-12 rounded-xl bg-[#111]/80" />
                <div className="absolute inset-x-3 top-24 h-8 rounded-xl bg-[#F15A00]" />
                {on && (
                  <span className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                )}
              </div>
              <span className="flex items-center gap-2 px-1 text-[15px] font-semibold">
                <Icon className="size-4" /> {label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 px-1 text-sm text-muted">System follows your phone or computer&apos;s setting. Saved on this device.</p>
    </div>
  );
}
