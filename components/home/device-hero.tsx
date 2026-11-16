"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, FlaskConical, Lock, LockOpen, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { CourierBadge } from "@/components/illustrations/courier-badge";
import { DropinDevice } from "@/components/illustrations/dropin-device";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { useCommand } from "@/hooks/use-command";
import { deviceVisual } from "@/lib/domain/device-state";
import { relativeTime } from "@/lib/domain/format";
import { can } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

/** The home screen's centrepiece: the collector, its compartment state and the unlock control. */
export function DeviceHero() {
  const { snapshot, device, deviceState } = useHousehold();
  const { send, pending } = useCommand();
  const visual = deviceVisual(device, deviceState);
  const waiting = snapshot.parcels.filter((p) => p.status === "received");
  const lastActivity = snapshot.activities.find((a) => a.device_id === device?.id);
  const online = device?.connection_status === "online";
  const canUnlock = can(snapshot.membership, "can_unlock");
  const unlocked = deviceState?.lock_status === "unlocked";

  const headline =
    visual.key === "awaiting" || visual.key === "deposited" ? (waiting.length > 1 ? `${waiting.length} parcels waiting` : visual.title) : visual.title;

  return (
    <section className="grain relative overflow-hidden rounded-[34px] bg-ink p-5 text-on-ink shadow-card sm:p-7" aria-label="Dropin status">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/25 blur-3xl" aria-hidden />
      <div className="relative flex items-center gap-2">
        <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold", online ? "bg-white/10" : "bg-white/6 text-on-ink-muted")}>
          {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {device?.connection_status === "pending" ? "Awaiting check-in" : online ? "Online" : "Offline"}
        </span>
        {device?.is_simulated && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-yellow/90 px-3 text-[12px] font-bold text-[#111]">
            <FlaskConical className="size-3.5" /> Simulated
          </span>
        )}
        <Link href="/device" className="ml-auto flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Device details">
          <ArrowUpRight className="size-5" />
        </Link>
      </div>

      <div className="relative mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="min-w-0 pb-2">
          <p className="text-sm font-semibold text-on-ink-muted">{device?.device_name ?? "Dropin"}</p>
          <motion.h2 key={headline} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-1 text-[clamp(2rem,8vw,3rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
            {headline}
          </motion.h2>
          <p className="mt-3 max-w-[16rem] text-[15px] leading-snug text-on-ink-muted">{visual.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-semibold">
              {unlocked ? <LockOpen className="size-3.5 text-accent" /> : <Lock className="size-3.5" />}
              {deviceState?.door_status === "open" ? "Door open" : "Door closed"} · {unlocked ? "Unlocked" : "Locked"}
            </span>
            {lastActivity && <span className="inline-flex h-8 items-center rounded-full bg-white/10 px-3 text-[13px] font-semibold">{relativeTime(lastActivity.created_at)}</span>}
          </div>
        </div>
        <div className="relative -mb-2 -mr-2 h-[230px] w-[138px] sm:h-[280px] sm:w-[168px]">
          <DropinDevice state={visual.key} className="h-full w-full" />
          {waiting[0] && (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute left-[-18px] top-[38%] flex items-center rounded-full bg-paper p-1 pr-3 shadow-float">
              <CourierBadge name={waiting[0].courier_name} className="size-9 text-[11px]" />
              {waiting.length > 1 && <span className="ml-1.5 text-[13px] font-bold text-[#111]">+{waiting.length - 1}</span>}
            </motion.div>
          )}
        </div>
      </div>

      <div className="relative mt-5">
        {!canUnlock ? (
          <p className="rounded-full bg-white/8 px-5 py-4 text-center text-sm text-on-ink-muted">Ask a household admin for unlock access.</p>
        ) : unlocked ? (
          <div className="flex items-center gap-3 rounded-full bg-white/10 p-1.5 pl-5">
            <LockOpen className="size-5 text-accent" />
            <p className="flex-1 text-sm font-semibold">Unlocked — open the door to collect</p>
            <Button variant="accent" size="md" loading={pending === "lock_compartment"} disabled={!online || deviceState?.door_status === "open"} onClick={() => send("lock_compartment", {}, { success: "Compartment locked" })}>
              Lock
            </Button>
          </div>
        ) : (
          <SlideToConfirm
            label={online ? (waiting.length ? "Slide to unlock" : "Unlock compartment") : "Device offline"}
            disabled={!online}
            pending={pending === "unlock_compartment"}
            onConfirm={() => send("unlock_compartment", { reason: "collect" }, { success: "Compartment unlocked", description: "It re-locks automatically when the door closes." })}
          />
        )}
      </div>
    </section>
  );
}
