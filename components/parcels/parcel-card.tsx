"use client";

import { Calendar, Check, PackageCheck } from "lucide-react";
import Link from "next/link";
import { CourierBadge } from "@/components/illustrations/courier-badge";
import { MediaImage } from "@/components/illustrations/media";
import type { Parcel } from "@/types/dropin";
import { formatWeight } from "@/lib/domain/format";
import { parcelTitle, parcelWhen } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

/**
 * Editorial parcel card: courier monogram, weight and status pills, a big
 * title, and the compartment photo bleeding off the corner.
 */
export function ParcelCard({ parcel, tz, highlight, className, tilt }: { parcel: Parcel; tz?: string; highlight?: boolean; className?: string; tilt?: number }) {
  const weight = formatWeight(parcel.weight_kg);
  const tone =
    parcel.status === "received" ? "bg-paper text-on-paper" : parcel.status === "expected" && highlight ? "bg-accent text-on-accent" : parcel.status === "collected" ? "bg-surface text-fg" : "bg-surface text-fg";
  const onAccent = parcel.status === "expected" && highlight;
  const pill = onAccent ? "bg-white/18 text-white" : parcel.status === "received" ? "bg-white/70 text-[#111]" : "bg-surface-2";

  return (
    <Link
      href={`/parcels/${parcel.id}`}
      className={cn("group relative block overflow-hidden rounded-[30px] p-5 shadow-card transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.99]", tone, className)}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <div className="relative z-10 flex items-start gap-2">
        <CourierBadge name={parcel.courier_name} />
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {weight && <span className={cn("flex h-9 items-center rounded-full px-3 text-[13px] font-semibold", pill)}>{weight}</span>}
          {parcel.status === "received" && (
            <span className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#111]">
              <Check className="size-4" strokeWidth={2.5} /> Arrived
            </span>
          )}
          {parcel.status === "expected" && (
            <span className={cn("flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold", onAccent ? "bg-black/20 text-white" : "bg-surface-2")}>
              <Calendar className="size-4" /> {parcelWhen(parcel, tz)}
            </span>
          )}
          {parcel.status === "collected" && (
            <span className="flex h-9 items-center gap-1.5 rounded-full bg-success-soft px-3.5 text-[13px] font-semibold text-success">
              <PackageCheck className="size-4" /> Collected
            </span>
          )}
        </div>
      </div>
      <div className={cn("relative z-10 mt-8", parcel.image_url && "pr-[38%]")}>
        <h3 className="text-[26px] font-semibold leading-[1.05] tracking-[-0.035em]">{parcelTitle(parcel)}</h3>
        <p className={cn("mt-2 truncate text-sm", onAccent ? "text-white/75" : "opacity-60")}>{parcel.tracking_number ?? parcel.sender ?? "No tracking number"}</p>
        {parcel.status !== "expected" && <p className={cn("mt-1 text-sm font-medium", onAccent ? "text-white/75" : "opacity-60")}>{parcelWhen(parcel, tz)}</p>}
      </div>
      {parcel.image_url && (
        <div className="absolute -bottom-3 -right-3 h-[62%] w-[44%] overflow-hidden rounded-[26px] shadow-card ring-4 ring-white/40 transition-transform duration-300 group-hover:-rotate-2">
          <MediaImage src={parcel.image_url} kind="parcel" alt={parcelTitle(parcel)} label={false} />
        </div>
      )}
    </Link>
  );
}
