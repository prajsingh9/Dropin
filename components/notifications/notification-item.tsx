"use client";

import { Bell, BellRing, CircleCheck, CircleX, DoorOpen, KeyRound, Moon, Package, PackageCheck, ShieldAlert, Wifi, WifiOff, type LucideIcon } from "lucide-react";
import type { AppNotification } from "@/types/dropin";
import { MediaImage } from "@/components/illustrations/media";
import { formatTime, relativeTime } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export const NOTIFICATION_ICON: Record<AppNotification["event_type"], { icon: LucideIcon; tone: string }> = {
  parcel_received: { icon: Package, tone: "bg-accent text-on-accent" },
  visitor_at_door: { icon: BellRing, tone: "bg-ink text-on-ink" },
  doorbell_pressed: { icon: Bell, tone: "bg-ink text-on-ink" },
  access_request: { icon: KeyRound, tone: "bg-yellow text-[#111]" },
  access_granted: { icon: CircleCheck, tone: "bg-success-soft text-success" },
  access_denied: { icon: CircleX, tone: "bg-danger-soft text-danger" },
  parcel_collected: { icon: PackageCheck, tone: "bg-success-soft text-success" },
  compartment_left_open: { icon: DoorOpen, tone: "bg-danger text-white" },
  device_disconnected: { icon: WifiOff, tone: "bg-surface-3 text-fg" },
  device_reconnected: { icon: Wifi, tone: "bg-success-soft text-success" },
  security_alert: { icon: ShieldAlert, tone: "bg-danger text-white" },
};

export function NotificationItem({ n, tz, onOpen }: { n: AppNotification; tz?: string; onOpen: (n: AppNotification) => void }) {
  const meta = NOTIFICATION_ICON[n.event_type] ?? { icon: Bell, tone: "bg-surface-2 text-fg" };
  const Icon = meta.icon;
  const unread = !n.read_at;
  return (
    <button onClick={() => onOpen(n)} className={cn("flex w-full items-start gap-4 rounded-[24px] p-4 text-left transition", unread ? "bg-surface shadow-card" : "hover:bg-surface/60")}>
      <span className={cn("relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full", meta.tone)}>
        {n.image_url ? <MediaImage src={n.image_url} kind={n.category === "parcels" ? "parcel" : "visitor"} alt="" label={false} /> : <Icon className="size-5" strokeWidth={1.9} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("truncate text-[15px]", unread ? "font-bold" : "font-semibold")}>{n.title}</span>
          <time dateTime={n.created_at} className="shrink-0 text-[12px] font-medium text-muted" title={formatTime(n.created_at, tz)}>
            {relativeTime(n.created_at)}
          </time>
        </span>
        <span className="mt-0.5 block text-[14px] leading-snug text-muted">{n.description}</span>
        {n.silent && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-semibold text-muted">
            <Moon className="size-3" /> Delivered silently
          </span>
        )}
      </span>
      {unread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </button>
  );
}
