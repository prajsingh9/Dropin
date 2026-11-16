import { Bell, CircleCheck, CircleX, DoorClosed, DoorOpen, KeyRound, Moon, Package, PackageCheck, ScanFace, ShieldAlert, UserPlus, Wifi, WifiOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { MediaImage } from "@/components/illustrations/media";
import type { Activity, HouseholdSnapshot } from "@/types/dropin";
import { formatTime } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export const ACTIVITY_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  parcel_deposited: { icon: Package, tone: "bg-accent text-on-accent" },
  parcel_expected: { icon: Package, tone: "bg-paper text-on-paper" },
  parcel_collected: { icon: PackageCheck, tone: "bg-success-soft text-success" },
  doorbell_pressed: { icon: Bell, tone: "bg-ink text-on-ink" },
  visitor_detected: { icon: ScanFace, tone: "bg-ink text-on-ink" },
  access_requested: { icon: KeyRound, tone: "bg-yellow text-[#111]" },
  access_granted: { icon: CircleCheck, tone: "bg-success-soft text-success" },
  access_denied: { icon: CircleX, tone: "bg-danger-soft text-danger" },
  compartment_opened: { icon: DoorOpen, tone: "bg-surface-2 text-fg" },
  compartment_closed: { icon: DoorClosed, tone: "bg-surface-2 text-fg" },
  compartment_left_open: { icon: ShieldAlert, tone: "bg-danger text-white" },
  device_online: { icon: Wifi, tone: "bg-success-soft text-success" },
  device_offline: { icon: WifiOff, tone: "bg-surface-3 text-fg" },
  quiet_hours_changed: { icon: Moon, tone: "bg-ink text-on-ink" },
  quiet_hours_updated: { icon: Moon, tone: "bg-ink text-on-ink" },
  member_invited: { icon: UserPlus, tone: "bg-paper text-on-paper" },
  member_removed: { icon: UserPlus, tone: "bg-surface-2 text-fg" },
  command: { icon: KeyRound, tone: "bg-surface-2 text-fg" },
  camera_stream_available: { icon: ScanFace, tone: "bg-surface-2 text-fg" },
};

/** Where an activity links to, and which image it carries. */
export function activityContext(a: Activity, snap: Pick<HouseholdSnapshot, "parcels" | "visitors">) {
  const m = a.metadata as Record<string, unknown>;
  const visitor = typeof m.visitor_id === "string" ? snap.visitors.find((v) => v.id === m.visitor_id) : undefined;
  const parcel = typeof m.parcel_id === "string" ? snap.parcels.find((p) => p.id === m.parcel_id) : undefined;
  const href = visitor ? `/visitors/${visitor.id}` : parcel ? `/parcels/${parcel.id}` : a.category === "device" ? "/device" : null;
  const image = visitor?.image_url ? { src: visitor.image_url, kind: "visitor" as const } : parcel?.image_url ? { src: parcel.image_url, kind: "parcel" as const } : null;
  return { href, image, quiet: Boolean(m.quiet_hours) || visitor?.during_quiet_hours };
}

export function ActivityItem({ activity, snapshot, tz, showLine = true, compact }: { activity: Activity; snapshot: Pick<HouseholdSnapshot, "parcels" | "visitors">; tz?: string; showLine?: boolean; compact?: boolean }) {
  const meta = ACTIVITY_ICON[activity.event_type] ?? { icon: Bell, tone: "bg-surface-2 text-fg" };
  const Icon = meta.icon;
  const { href, image, quiet } = activityContext(activity, snapshot);
  const body = (
    <div className="flex gap-4">
      <div className="relative flex flex-col items-center">
        <span className={cn("relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full", meta.tone)}>
          <Icon className="size-5" strokeWidth={1.9} />
        </span>
        {showLine && <span className="absolute top-11 h-[calc(100%-8px)] w-px bg-line" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[16px] font-semibold tracking-[-0.01em]">{activity.title}</p>
          <time dateTime={activity.created_at} className="shrink-0 text-[13px] font-medium text-muted">
            {formatTime(activity.created_at, tz)}
          </time>
        </div>
        <p className="mt-0.5 text-[14px] leading-snug text-muted">{activity.description}</p>
        {quiet && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-muted">
            <Moon className="size-3" /> Quiet hours
          </span>
        )}
        {image && (
          <div className={cn("mt-3 overflow-hidden rounded-[18px] bg-surface-2", compact ? "h-16 w-24" : "h-28 w-44")}>
            <MediaImage src={image.src} kind={image.kind} alt={activity.title} label={false} />
          </div>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl transition-colors hover:bg-surface-2/50">
      {body}
    </Link>
  ) : (
    body
  );
}
