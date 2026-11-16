import { ChevronRight, Moon } from "lucide-react";
import Link from "next/link";
import { MediaImage } from "@/components/illustrations/media";
import type { Visitor } from "@/types/dropin";
import { dayLabel, formatTime } from "@/lib/domain/format";
import { effectiveVisitorStatus, REQUEST_TYPE_LABEL, VISITOR_STATUS_LABEL, visitorName } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<Visitor["status"], string> = {
  detected: "bg-surface-2 text-fg",
  ringing: "bg-accent text-on-accent",
  answered: "bg-surface-2 text-fg",
  pending: "bg-yellow text-[#111]",
  approved: "bg-success-soft text-success",
  denied: "bg-danger-soft text-danger",
  declined: "bg-surface-2 text-muted",
  missed: "bg-surface-2 text-muted",
  ended: "bg-surface-2 text-muted",
};

export function VisitorRow({ visitor, tz }: { visitor: Visitor; tz?: string }) {
  const status = effectiveVisitorStatus(visitor);
  return (
    <Link href={`/visitors/${visitor.id}`} className="flex items-center gap-4 rounded-[26px] bg-surface p-3 pr-4 shadow-card transition hover:-translate-y-0.5 active:scale-[0.99]">
      <div className="relative size-[72px] shrink-0 overflow-hidden rounded-[20px] bg-surface-2">
        <MediaImage src={visitor.image_url} kind="visitor" alt={visitorName(visitor)} label={false} night={visitor.during_quiet_hours} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold">{visitorName(visitor)}</p>
        <p className="truncate text-[13px] text-muted">
          {REQUEST_TYPE_LABEL[visitor.request_type]} · {dayLabel(visitor.arrived_at, tz)}, {formatTime(visitor.arrived_at, tz)}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", STATUS_TONE[status])}>{VISITOR_STATUS_LABEL[status]}</span>
          {visitor.during_quiet_hours && (
            <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-muted">
              <Moon className="size-3" /> Silent
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" />
    </Link>
  );
}
