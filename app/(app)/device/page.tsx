"use client";

import { BellRing, Camera, ChevronRight, Cpu, DoorClosed, DoorOpen, FlaskConical, Lock, LockOpen, Moon, Package, Pencil, Power, RefreshCw, ShieldCheck, Trash2, Wifi, WifiOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DropinDevice } from "@/components/illustrations/dropin-device";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button, IconButton } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { errorMessage, useToast } from "@/components/ui/toast";
import { useCommand } from "@/hooks/use-command";
import { COMMAND_LABELS } from "@/lib/domain/commands";
import { deviceVisual } from "@/lib/domain/device-state";
import { formatDateTime, relativeTime } from "@/lib/domain/format";
import { describeDays, formatClock } from "@/lib/domain/quiet-hours";
import { can, isAdmin } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

function Tile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: "good" | "warn" | "bad" | "accent" }) {
  return (
    <div className="rounded-[24px] bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-muted" strokeWidth={1.9} />
        {tone && <span className={cn("size-2.5 rounded-full", tone === "good" && "bg-success", tone === "warn" && "bg-yellow", tone === "bad" && "bg-danger", tone === "accent" && "bg-accent")} />}
      </div>
      <p className="mt-4 text-[13px] text-muted">{label}</p>
      <p className="truncate text-[17px] font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  );
}

function Row({ icon: Icon, title, detail, href, children, onClick }: { icon: LucideIcon; title: string; detail?: string; href?: string; children?: React.ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {detail && <span className="block truncate text-[13px] text-muted">{detail}</span>}
      </span>
      {children ?? (href || onClick ? <ChevronRight className="size-5 text-muted" /> : null)}
    </>
  );
  const cls = "flex w-full items-center gap-4 px-5 py-4 text-left";
  if (href) return <Link href={href} className={cn(cls, "hover:bg-surface-2/50")}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className={cn(cls, "hover:bg-surface-2/50")}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export default function DevicePage() {
  const { snapshot, device, deviceState, run } = useHousehold();
  const { send, pending } = useCommand();
  const toast = useToast();
  const router = useRouter();
  const [volumeDraft, setVolume] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(device?.device_name ?? "");
  const [confirm, setConfirm] = useState<"restart" | "remove" | null>(null);

  if (!device) {
    return (
      <>
        <PageHeader title="Device" back="/settings" />
        <EmptyState icon={<Cpu className="size-7" />} title="No Dropin paired" description="This household doesn't have a device yet." />
      </>
    );
  }

  const visual = deviceVisual(device, deviceState);
  const online = device.connection_status === "online";
  const manage = can(snapshot.membership, "can_manage_device");
  const admin = isAdmin(snapshot.membership);
  const q = snapshot.quietHours;
  const commands = snapshot.commands.filter((c) => c.device_id === device.id).slice(0, 6);
  const signal = device.wifi_signal ?? 0;
  const volume = volumeDraft ?? device.doorbell_volume;

  return (
    <>
      <PageHeader
        back="/home"
        eyebrow={<span className="font-mono">{device.device_identifier}</span>}
        title={device.device_name}
        actions={
          manage && (
            <IconButton label="Rename device" variant="outline" onClick={() => setRenaming(true)}>
              <Pencil className="size-5" />
            </IconButton>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-5">
          <div className="grain relative flex items-end gap-4 overflow-hidden rounded-[34px] bg-ink p-6 text-on-ink shadow-card">
            <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative min-w-0 flex-1 pb-2">
              <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold", online ? "bg-success/20 text-[#7ee2a8]" : "bg-white/10 text-on-ink-muted")}>
                {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />} {device.connection_status === "pending" ? "Awaiting check-in" : online ? "Online" : "Offline"}
              </span>
              <h2 className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.04em]">{visual.title}</h2>
              <p className="mt-2 text-sm text-on-ink-muted">{visual.description}</p>
              {device.is_simulated && (
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-yellow px-3 py-1 text-[12px] font-bold text-[#111]">
                  <FlaskConical className="size-3.5" /> Simulated hardware
                </span>
              )}
            </div>
            <div className="relative h-[250px] w-[150px] shrink-0">
              <DropinDevice state={visual.key} className="h-full w-full" />
            </div>
          </div>

          {device.connection_status === "pending" && (
            <div className="rounded-card bg-paper p-5 text-on-paper">
              <p className="font-semibold">Waiting for your Dropin</p>
              <p className="mt-1 text-sm opacity-75">The device is registered but hasn&apos;t connected yet. Make sure it&apos;s powered and joined to Wi-Fi. It authenticates with its pairing code, then appears online here.</p>
            </div>
          )}
          {device.connection_status === "offline" && (
            <div className="rounded-card bg-surface-2 p-5">
              <p className="font-semibold">Showing the last known state</p>
              <p className="mt-1 text-sm text-muted">Last heard from {device.last_seen_at ? relativeTime(device.last_seen_at) : "never"}. Unlocking is unavailable; settings you change will sync when it reconnects.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Tile icon={online ? Wifi : WifiOff} label="Wi-Fi" value={device.wifi_ssid ? `${device.wifi_ssid}${online ? ` · ${signal}%` : ""}` : "Not reported"} tone={!online ? "bad" : signal > 60 ? "good" : "warn"} />
            <Tile icon={Package} label="Compartment" value={deviceState?.compartment_status === "occupied" ? "Parcel inside" : deviceState?.compartment_status === "error" ? "Fault" : "Empty"} tone={deviceState?.compartment_status === "occupied" ? "accent" : deviceState?.compartment_status === "error" ? "bad" : "good"} />
            <Tile icon={deviceState?.door_status === "open" ? DoorOpen : DoorClosed} label="Door" value={deviceState?.door_status === "open" ? "Open" : "Closed"} tone={deviceState?.door_status === "open" ? "warn" : "good"} />
            <Tile icon={deviceState?.lock_status === "unlocked" ? LockOpen : Lock} label="Lock" value={deviceState?.lock_status === "unlocked" ? "Unlocked" : "Locked"} tone={deviceState?.lock_status === "unlocked" ? "warn" : "good"} />
            <Tile icon={Camera} label="Camera" value={deviceState?.camera_status === "streaming" ? "Streaming" : deviceState?.camera_status === "offline" || !online ? "Offline" : "Ready"} tone={deviceState?.camera_status === "offline" || !online ? "bad" : "good"} />
            <Tile icon={Cpu} label="Firmware" value={device.firmware_version ?? "Unknown"} />
            <Tile icon={RefreshCw} label="Last sync" value={device.last_seen_at ? relativeTime(device.last_seen_at) : "Never"} />
            <Tile icon={ShieldCheck} label="Health" value={visual.key === "error" ? "Needs attention" : online ? "Good" : "Unknown"} tone={visual.key === "error" ? "bad" : online ? "good" : "warn"} />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-7">
          <section>
            <SectionHeader title="Doorbell" />
            <div className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
              <Row icon={BellRing} title="Outdoor chime" detail={device.doorbell_enabled ? "Plays when someone rings" : "Silent — you'll still be notified"}>
                <Switch checked={device.doorbell_enabled} disabled={!manage || pending === "enable_doorbell" || pending === "disable_doorbell"} label="Outdoor chime" onChange={(v) => send(v ? "enable_doorbell" : "disable_doorbell", {}, { success: v ? "Chime turned on" : "Chime turned off" })} />
              </Row>
              <div className="px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[15px] font-semibold">Volume</p>
                  <p className="text-sm font-semibold tabular-nums text-muted">
                    {volume}%{pending === "set_doorbell_volume" ? " · syncing" : ""}
                  </p>
                </div>
                <Slider label="Doorbell volume" value={volume} onChange={setVolume} disabled={!manage || !device.doorbell_enabled} onCommit={async (v) => {
                    if (v !== device.doorbell_volume) await send("set_doorbell_volume", { volume: v }, { success: `Volume set to ${v}%` });
                    setVolume(null);
                  }} />
              </div>
              <Row icon={Moon} title="Quiet hours" detail={q?.enabled ? `${formatClock(q.start_time)} – ${formatClock(q.end_time)} · ${describeDays(q.days_of_week)}` : "Off"} href="/device/quiet-hours" />
            </div>
          </section>

          <section>
            <SectionHeader title="Controls" />
            <div className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
              <Row icon={deviceState?.lock_status === "unlocked" ? LockOpen : Lock} title={deviceState?.lock_status === "unlocked" ? "Lock compartment" : "Unlock compartment"} detail={online ? "Requires the device to confirm" : "Unavailable while offline"}>
                <Button
                  size="sm"
                  variant={deviceState?.lock_status === "unlocked" ? "ink" : "accent"}
                  disabled={!online || !can(snapshot.membership, "can_unlock")}
                  loading={pending === "unlock_compartment" || pending === "lock_compartment"}
                  onClick={() => (deviceState?.lock_status === "unlocked" ? send("lock_compartment", {}, { success: "Compartment locked" }) : send("unlock_compartment", {}, { success: "Compartment unlocked" }))}
                >
                  {deviceState?.lock_status === "unlocked" ? "Lock" : "Unlock"}
                </Button>
              </Row>
              <Row icon={Camera} title="Camera & live view" detail={can(snapshot.membership, "can_view_camera") ? "Open the doorbell camera" : "Your access is turned off"} href="/visitors/live/monitor" />
              <Row icon={BellRing} title="Notification preferences" detail="Parcels, visitors, device alerts" href="/settings/notifications" />
              {manage && <Row icon={Power} title="Restart device" detail={online ? "Takes about a minute" : "Unavailable while offline"} onClick={online ? () => setConfirm("restart") : undefined} />}
              {admin && (
                <button onClick={() => setConfirm("remove")} className="flex w-full items-center gap-4 px-5 py-4 text-left text-danger hover:bg-danger-soft/50">
                  <span className="flex size-11 items-center justify-center rounded-full bg-danger-soft">
                    <Trash2 className="size-5" />
                  </span>
                  <span className="text-[15px] font-semibold">Remove device</span>
                </button>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Recent commands" />
            <div className="overflow-hidden rounded-card bg-surface shadow-card">
              {commands.length ? (
                commands.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{COMMAND_LABELS[c.command_type]}</p>
                      <p className="text-[12px] text-muted">{formatDateTime(c.created_at, snapshot.household.timezone)}{c.error ? ` · ${c.error}` : ""}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                        c.status === "completed" && "bg-success-soft text-success",
                        (c.status === "pending" || c.status === "sent") && "bg-yellow/30",
                        (c.status === "failed" || c.status === "expired") && "bg-danger-soft text-danger",
                      )}
                    >
                      {c.status === "completed" ? "Confirmed" : c.status === "pending" ? (online ? "Sending" : "Queued") : c.status === "sent" ? "Awaiting device" : c.status === "expired" ? "Expired" : "Failed"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-5 py-5 text-sm text-muted">Commands you send to the device will be listed here with their confirmation status.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Rename device">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await run((c) => c.renameDevice(device.id, name));
              toast.push({ tone: "success", title: "Device renamed" });
              setRenaming(false);
            } catch (err) {
              toast.push({ tone: "error", title: "Couldn't rename", description: errorMessage(err) });
            }
          }}
        >
          <Field label="Name" htmlFor="dname">
            <Input id="dname" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </Field>
          <Button type="submit" block size="lg" disabled={name.trim().length < 2}>
            Save
          </Button>
        </form>
      </Sheet>

      <ConfirmDialog open={confirm === "restart"} onClose={() => setConfirm(null)} icon={<Power className="size-6" />} title="Restart your Dropin?" description="The doorbell and compartment will be unavailable for about a minute. Parcels stay locked." confirmLabel="Restart" onConfirm={async () => void (await send("restart_device", {}, { success: "Restart confirmed by device" }))} />
      <ConfirmDialog
        open={confirm === "remove"}
        onClose={() => setConfirm(null)}
        destructive
        icon={<Trash2 className="size-6" />}
        title="Remove this device?"
        description={`${device.device_name} will be unpaired from ${snapshot.household.name}. History is kept. You'll need the pairing code to add it again.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          try {
            await run((c) => c.removeDevice(device.id));
            toast.push({ tone: "success", title: "Device removed" });
            router.replace("/settings");
          } catch (e) {
            toast.push({ tone: "error", title: "Couldn't remove device", description: errorMessage(e) });
            throw e;
          }
        }}
      />
    </>
  );
}
