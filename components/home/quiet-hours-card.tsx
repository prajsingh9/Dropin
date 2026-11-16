"use client";

import { ChevronRight, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Switch } from "@/components/ui/switch";
import { errorMessage, useToast } from "@/components/ui/toast";
import { describeDays, formatClock, isQuietHoursActive } from "@/lib/domain/quiet-hours";
import { isAdmin } from "@/lib/domain/permissions";

export function QuietHoursCard() {
  const { snapshot, run } = useHousehold();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const q = snapshot.quietHours;
  const active = isQuietHoursActive(q);
  const admin = isAdmin(snapshot.membership);

  const toggle = async (enabled: boolean) => {
    if (!q) return;
    setBusy(true);
    try {
      const res = await run((c) => c.updateQuietHours({ enabled, start_time: q.start_time, end_time: q.end_time, days_of_week: q.days_of_week, timezone: q.timezone }));
      toast.push({ tone: res.synced ? "success" : "info", title: enabled ? "Quiet hours on" : "Quiet hours off", description: res.synced ? "Synced to your doorbell." : "Saved. It'll sync when your device is online." });
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't update quiet hours", description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-card p-5 shadow-card ${active ? "bg-[#1d1b2e] text-white" : "bg-surface"}`}>
      {active && <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#6f5cff]/30 blur-2xl" aria-hidden />}
      <div className="relative flex items-start justify-between gap-3">
        <div className={`flex size-12 items-center justify-center rounded-full ${active ? "bg-white/12" : "bg-ink text-on-ink"}`}>{active ? <Moon className="size-5" /> : q?.enabled ? <Moon className="size-5" /> : <Sun className="size-5" />}</div>
        <Switch checked={Boolean(q?.enabled)} onChange={toggle} disabled={busy || !q || !admin} label="Quiet hours" />
      </div>
      <Link href="/device/quiet-hours" className="relative mt-5 block">
        <p className={`text-sm font-semibold ${active ? "text-white/60" : "text-muted"}`}>Quiet hours{active ? " · active now" : ""}</p>
        <p className="mt-1 flex items-center gap-1 text-[22px] font-semibold tracking-[-0.03em]">
          {q ? `${formatClock(q.start_time)} – ${formatClock(q.end_time)}` : "Not set"}
          <ChevronRight className="size-5 opacity-50" />
        </p>
        <p className={`mt-1 text-sm ${active ? "text-white/60" : "text-muted"}`}>{q?.enabled ? (active ? "Doorbell chime is silenced. You'll still be notified." : describeDays(q.days_of_week)) : "Doorbell chimes at all hours."}</p>
      </Link>
    </div>
  );
}
