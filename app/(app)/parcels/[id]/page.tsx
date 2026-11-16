"use client";

import { Check, Copy, PackageCheck, PackageX, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CourierBadge } from "@/components/illustrations/courier-badge";
import { MediaImage } from "@/components/illustrations/media";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button, IconButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { errorMessage, useToast } from "@/components/ui/toast";
import { useCommand } from "@/hooks/use-command";
import { formatDateTime, formatWeight } from "@/lib/domain/format";
import { parcelTitle } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { snapshot, run, device, deviceState } = useHousehold();
  const router = useRouter();
  const toast = useToast();
  const { send, pending } = useCommand();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const parcel = snapshot.parcels.find((p) => p.id === id);
  const tz = snapshot.household.timezone;

  if (!parcel) {
    return (
      <>
        <PageHeader title="Parcel" back="/parcels" />
        <EmptyState icon={<PackageX className="size-7" />} title="Parcel not found" description="It may have been removed by another household member." />
      </>
    );
  }

  const collector = parcel.collected_by ? snapshot.members.find((m) => m.user_id === parcel.collected_by)?.profile?.full_name : null;
  const steps = [
    { label: "Expected", at: parcel.expected_at, done: true },
    { label: "Delivered", at: parcel.deposited_at, done: parcel.status !== "expected" },
    { label: "Collected", at: parcel.collected_at, done: parcel.status === "collected" },
  ];
  const online = device?.connection_status === "online";
  const unlocked = deviceState?.lock_status === "unlocked";

  const rows: [string, React.ReactNode][] = [
    ["Courier", parcel.courier_name ?? "Not identified"],
    ["From", parcel.sender ?? "—"],
    ["Weight", formatWeight(parcel.weight_kg) ?? "—"],
    ["Source", parcel.source === "device" ? "Detected by Dropin" : "Added manually"],
  ];
  if (parcel.collected_at) rows.push(["Collected by", collector ?? "Detected by compartment sensor"]);

  const markCollected = async () => {
    setCollecting(true);
    try {
      await run((c) => c.markParcelCollected(parcel.id));
      toast.push({ tone: "success", title: "Marked as collected" });
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't update parcel", description: errorMessage(e) });
    } finally {
      setCollecting(false);
    }
  };

  return (
    <>
      <PageHeader
        back="/parcels"
        title={parcelTitle(parcel)}
        actions={
          parcel.status === "expected" ? (
            <IconButton label="Remove parcel" variant="outline" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-5" />
            </IconButton>
          ) : null
        }
      >
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone={parcel.status === "received" ? "accent" : parcel.status === "collected" ? "success" : "neutral"}>{parcel.status === "received" ? "In the compartment" : parcel.status === "collected" ? "Collected" : "On the way"}</Chip>
          {parcel.deposited_at && <Chip tone="outline">Delivered {formatDateTime(parcel.deposited_at, tz)}</Chip>}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-paper shadow-card">
            {parcel.image_url ? (
              <MediaImage src={parcel.image_url} kind="parcel" alt={parcelTitle(parcel)} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-on-paper">
                <CourierBadge name={parcel.courier_name} className="size-20 text-2xl" />
                <p className="text-sm font-semibold opacity-60">{parcel.status === "expected" ? "A photo is taken when it's deposited" : "No photo was captured"}</p>
              </div>
            )}
          </div>
          {!parcel.courier_name && parcel.status !== "expected" && (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Dropin couldn&apos;t identify who delivered this parcel. Check the photo and your order emails — it was still locked safely inside.</p>
          )}
        </div>

        <div className="space-y-4">
          {parcel.status === "received" && (
            <div className="space-y-3 rounded-card bg-ink p-5 text-on-ink shadow-card">
              <p className="text-sm font-semibold text-on-ink-muted">Collect your parcel</p>
              {unlocked ? (
                <p className="rounded-full bg-white/10 px-5 py-4 text-sm font-semibold">Compartment unlocked — open the door and take your parcel.</p>
              ) : (
                <SlideToConfirm label={online ? "Slide to unlock" : "Device offline"} disabled={!online || !can(snapshot.membership, "can_unlock")} pending={pending === "unlock_compartment"} onConfirm={() => send("unlock_compartment", { reason: "collect" }, { success: "Compartment unlocked" })} />
              )}
              <Button variant="paper" block icon={<PackageCheck className="size-5" />} loading={collecting} onClick={markCollected}>
                I&apos;ve collected it
              </Button>
              <p className="text-center text-xs text-on-ink-muted">The compartment sensor usually detects this automatically.</p>
            </div>
          )}

          <div className="rounded-card bg-surface p-5 shadow-card">
            <ol className="flex items-start">
              {steps.map((s, i) => (
                <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
                  {i > 0 && <span className={cn("absolute right-1/2 top-4 h-0.5 w-full", s.done ? "bg-accent" : "bg-surface-3")} aria-hidden />}
                  <span className={cn("relative z-10 flex size-8 items-center justify-center rounded-full", s.done ? "bg-accent text-on-accent" : "bg-surface-2 text-muted")}>{s.done ? <Check className="size-4" strokeWidth={3} /> : <span className="size-2 rounded-full bg-current" />}</span>
                  <span className="mt-2 text-[13px] font-semibold">{s.label}</span>
                  <span className="text-[12px] text-muted">{s.at && (s.done || s.label === "Expected") ? formatDateTime(s.at, tz) : "—"}</span>
                </li>
              ))}
            </ol>
          </div>

          <dl className="divide-y divide-line rounded-card bg-surface px-5 shadow-card">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-muted">Tracking</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[14px] font-semibold">{parcel.tracking_number ?? "—"}</span>
                {parcel.tracking_number && (
                  <button
                    aria-label="Copy tracking number"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(parcel.tracking_number!).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </button>
                )}
              </dd>
            </div>
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-4">
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="text-right text-[15px] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        destructive
        icon={<Trash2 className="size-6" />}
        title="Remove this parcel?"
        description="It will no longer be matched when a courier delivers it."
        confirmLabel="Remove"
        onConfirm={async () => {
          try {
            await run((c) => c.deleteExpectedParcel(parcel.id));
            toast.push({ tone: "success", title: "Parcel removed" });
            router.replace("/parcels?tab=expected");
          } catch (e) {
            toast.push({ tone: "error", title: "Couldn't remove", description: errorMessage(e) });
            throw e;
          }
        }}
      />
    </>
  );
}
