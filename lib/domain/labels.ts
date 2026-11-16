import type { Parcel, Visitor } from "@/types/dropin";
import { dayLabel, formatTime } from "./format";

export function parcelTitle(p: Pick<Parcel, "courier_name">) {
  return p.courier_name ? `Parcel from ${p.courier_name}` : "Parcel · courier unknown";
}

export function parcelWhen(p: Parcel, tz?: string): string {
  if (p.status === "expected") {
    if (!p.expected_at) return "Date not set";
    return `${dayLabel(p.expected_at, tz)} · ${formatTime(p.expected_at, tz)}`;
  }
  if (p.status === "received" && p.deposited_at) return `Arrived ${dayLabel(p.deposited_at, tz).toLowerCase()} · ${formatTime(p.deposited_at, tz)}`;
  if (p.status === "collected" && p.collected_at) return `Collected ${dayLabel(p.collected_at, tz).toLowerCase()} · ${formatTime(p.collected_at, tz)}`;
  return "";
}

export const VISITOR_STATUS_LABEL: Record<Visitor["status"], string> = {
  detected: "Detected",
  ringing: "Ringing",
  answered: "Answered",
  pending: "Awaiting decision",
  approved: "Access granted",
  denied: "Access denied",
  declined: "Declined",
  missed: "Missed",
  ended: "Ended",
};

export const REQUEST_TYPE_LABEL: Record<Visitor["request_type"], string> = {
  doorbell: "Doorbell",
  building_entry: "Building entry",
  parcel_delivery: "Parcel delivery",
  leave_parcel: "Leave a parcel",
};

/** A ringing call that nobody picked up within 90s is shown as missed. */
export function effectiveVisitorStatus(v: Visitor, now = Date.now()): Visitor["status"] {
  if (v.status === "ringing" && now - new Date(v.arrived_at).getTime() > 90_000) return "missed";
  if (v.status === "pending" && now - new Date(v.arrived_at).getTime() > 10 * 60_000) return "missed";
  return v.status;
}

export function visitorName(v: Pick<Visitor, "visitor_name" | "request_type">) {
  if (v.visitor_name) return v.visitor_name;
  return v.request_type === "parcel_delivery" || v.request_type === "leave_parcel" ? "Delivery person" : "Unknown visitor";
}
