"use client";

import { Moon, Phone, ScanFace, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActivityItem } from "@/components/activity/activity-item";
import { MediaImage } from "@/components/illustrations/media";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { useVisitorDecision } from "@/components/visitors/access-request-card";
import { STATUS_TONE } from "@/components/visitors/visitor-row";
import { formatDateTime, relativeTime } from "@/lib/domain/format";
import { effectiveVisitorStatus, REQUEST_TYPE_LABEL, VISITOR_STATUS_LABEL, visitorName } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

const ASK: Record<string, string> = {
  doorbell: "rang your doorbell",
  building_entry: "wants to enter the building",
  parcel_delivery: "wants to deliver a parcel",
  leave_parcel: "wants to leave a parcel in your Dropin",
};

export default function VisitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { snapshot, device } = useHousehold();
  const { decide, busy } = useVisitorDecision();
  const v = snapshot.visitors.find((x) => x.id === id);
  const tz = snapshot.household.timezone;

  if (!v) {
    return (
      <>
        <PageHeader title="Visitor" back="/visitors" />
        <EmptyState icon={<ScanFace className="size-7" />} title="Visit not found" description="It may be older than your history, or you may not have camera access." />
      </>
    );
  }

  const status = effectiveVisitorStatus(v);
  const decidable = status === "pending" || status === "ringing" || status === "answered";
  const canDecide = can(snapshot.membership, "can_manage_access");
  const responder = v.responded_by ? snapshot.members.find((m) => m.user_id === v.responded_by)?.profile?.full_name ?? "A household member" : null;
  const trail = snapshot.activities.filter((a) => (a.metadata as Record<string, unknown>).visitor_id === v.id);
  const online = device?.connection_status === "online";

  return (
    <>
      <PageHeader back="/visitors" eyebrow={REQUEST_TYPE_LABEL[v.request_type]} title={`${visitorName(v)} ${ASK[v.request_type]}`}>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold", STATUS_TONE[status])}>{VISITOR_STATUS_LABEL[status]}</span>
          <Chip tone="outline">
            {formatDateTime(v.arrived_at, tz)} · {relativeTime(v.arrived_at)}
          </Chip>
          {v.during_quiet_hours && (
            <Chip tone="ink" icon={<Moon className="size-3.5" />}>
              Quiet hours · no chime
            </Chip>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-ink shadow-card lg:col-span-7">
          <MediaImage src={v.image_url} kind="visitor" alt={`Snapshot of ${visitorName(v)}`} night={v.during_quiet_hours} />
          {(status === "ringing" || status === "answered") && can(snapshot.membership, "can_view_camera") && (
            <Link href={`/visitors/live/${v.id}`} className="absolute bottom-4 left-4 flex h-12 items-center gap-2 rounded-full bg-success px-5 text-[15px] font-semibold text-white shadow-float">
              <Phone className="size-5" /> {status === "answered" ? "Return to call" : "Answer"}
            </Link>
          )}
        </div>

        <div className="space-y-5 lg:col-span-5">
          {decidable && v.request_type !== "doorbell" ? (
            <div className="space-y-3 rounded-card bg-ink p-5 text-on-ink shadow-card">
              <p className="text-sm font-semibold text-on-ink-muted">Your decision</p>
              <SlideToConfirm label={online ? "Slide to let in" : "Device offline"} disabled={!canDecide || !online || !!busy} pending={busy === "approve"} startIcon={<ShieldCheck className="size-5" />} onConfirm={() => decide(v, "approve")} />
              <Button block variant="surface" className="!bg-white/10 !text-white !shadow-none" icon={<X className="size-5" />} loading={busy === "deny"} disabled={!canDecide || !!busy} onClick={() => decide(v, "deny")}>
                Deny access
              </Button>
              {!canDecide && <p className="text-center text-xs text-on-ink-muted">You don&apos;t have permission to approve visitors.</p>}
            </div>
          ) : decidable && v.request_type === "doorbell" && canDecide ? (
            <div className="space-y-3 rounded-card bg-ink p-5 text-on-ink shadow-card">
              <p className="text-sm font-semibold text-on-ink-muted">Let them in?</p>
              <SlideToConfirm label={online ? "Slide to unlock door" : "Device offline"} disabled={!online || !!busy} pending={busy === "approve"} onConfirm={() => decide(v, "approve")} />
            </div>
          ) : (
            <div className="rounded-card bg-surface p-5 shadow-card">
              <p className="text-sm text-muted">Outcome</p>
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{VISITOR_STATUS_LABEL[status]}</p>
              <p className="mt-1 text-sm text-muted">{responder && v.responded_at ? `${responder} · ${formatDateTime(v.responded_at, tz)}` : status === "missed" ? "No one answered." : "Recorded by your Dropin."}</p>
            </div>
          )}

          <div className="rounded-card bg-surface p-5 pb-0 shadow-card">
            <p className="mb-4 text-sm font-semibold text-muted">Audit trail</p>
            {trail.length ? trail.map((a, i) => <ActivityItem key={a.id} activity={a} snapshot={{ parcels: [], visitors: [] }} tz={tz} showLine={i < trail.length - 1} />) : <p className="pb-5 text-sm text-muted">No decisions recorded.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
