"use client";

import { BellOff, Check, Clock, LoaderCircle, Lock, Moon, ShieldCheck, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { useNow } from "@/hooks/use-now";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { errorMessage, useToast } from "@/components/ui/toast";
import { quietHoursInput } from "@/lib/backend/schemas";
import { formatDateTime } from "@/lib/domain/format";
import { DAY_LABELS, DAY_LETTERS, formatClock, isQuietHoursActive, parseHHMM, windowLength, zonedClock } from "@/lib/domain/quiet-hours";
import { DEFAULT_NOTIFICATION_PREFS, isAdmin } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

/** 24-hour dial showing the quiet window and the current time. */
function QuietDial({ start, end, enabled, tz }: { start: string; end: string; enabled: boolean; tz: string }) {
  const clock = useNow(30_000);
  const now = clock ? zonedClock(clock, tz).minutes : null;
  let s = 0,
    len = 0;
  try {
    s = parseHHMM(start);
    len = windowLength(start, end);
  } catch {}
  const R = 110;
  const C = 2 * Math.PI * R;
  const angle = (m: number) => (m / 1440) * 360 - 90;
  const pt = (m: number, r: number) => [130 + r * Math.cos((angle(m) * Math.PI) / 180), 130 + r * Math.sin((angle(m) * Math.PI) / 180)] as const;
  return (
    <svg viewBox="0 0 260 260" className="mx-auto w-full max-w-[300px]" role="img" aria-label={`Quiet from ${formatClock(start)} to ${formatClock(end)}`}>
      <circle cx="130" cy="130" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="26" />
      <circle
        cx="130"
        cy="130"
        r={R}
        fill="none"
        stroke={enabled ? "#F15A00" : "currentColor"}
        strokeOpacity={enabled ? 1 : 0.25}
        strokeWidth="26"
        strokeLinecap="round"
        strokeDasharray={`${(len / 1440) * C} ${C}`}
        transform={`rotate(${angle(s)} 130 130)`}
        style={{ transition: "stroke-dasharray .4s, transform .4s" }}
      />
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = pt(h * 60, 76);
        return (
          <text key={h} x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" opacity="0.45">
            {h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
          </text>
        );
      })}
      {now !== null && (
        <>
          <line x1="130" y1="130" x2={pt(now, 92)[0]} y2={pt(now, 92)[1]} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="130" cy="130" r="5" fill="currentColor" />
          <circle cx={pt(now, R)[0]} cy={pt(now, R)[1]} r="7" fill="var(--bg)" stroke="currentColor" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}

function zones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

export default function QuietHoursPage() {
  const { snapshot, run, device } = useHousehold();
  const toast = useToast();
  const q = snapshot.quietHours;
  const admin = isAdmin(snapshot.membership);
  const initial = useMemo(
    () => ({ enabled: q?.enabled ?? false, start_time: q?.start_time ?? "00:00", end_time: q?.end_time ?? "07:00", days_of_week: q?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6], timezone: q?.timezone ?? snapshot.household.timezone }),
    [q, snapshot.household.timezone],
  );
  const [form, setForm] = useState(initial);
  // Reset the form when the saved schedule changes (e.g. edited on another device).
  const savedKey = q?.updated_at ?? "none";
  const [formKey, setFormKey] = useState(savedKey);
  if (formKey !== savedKey) {
    setFormKey(savedKey);
    setForm(initial);
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const allZones = useMemo(() => {
    const z = zones();
    return z.includes(form.timezone) ? z : [form.timezone, ...z];
  }, [form.timezone]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const active = isQuietHoursActive(q);
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...snapshot.membership.notification_prefs };
  const synced = q?.synced_at && new Date(q.synced_at) >= new Date(q.updated_at);
  const online = device?.connection_status === "online";

  const toggleDay = (d: number) => setForm((f) => ({ ...f, days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d].sort() }));

  const save = async () => {
    const parsed = quietHoursInput.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (e[String(i.path[0])] = i.message));
      return setErrors(e);
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await run((c) => c.updateQuietHours(parsed.data));
      toast.push({ tone: res.synced ? "success" : "info", title: "Quiet hours saved", description: res.synced ? "Your doorbell confirmed the new schedule." : "Saved to your account. It'll sync when your Dropin is online." });
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't save quiet hours", description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const setQuietMode = async (mode: "silent" | "hold") => {
    try {
      await run((c) => c.updateNotificationPrefs({ ...prefs, quiet_mode: mode }));
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't save", description: errorMessage(e) });
    }
  };

  return (
    <>
      <PageHeader back="/device" eyebrow={active ? "Active now" : q?.enabled ? "Scheduled" : "Off"} title="Quiet hours" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-5">
          <div className={cn("relative overflow-hidden rounded-card p-6 shadow-card", form.enabled ? "bg-[#17162a] text-white" : "bg-surface")}>
            {form.enabled && <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[#6f5cff]/30 blur-3xl" />}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={cn("flex size-11 items-center justify-center rounded-full", form.enabled ? "bg-white/12" : "bg-surface-2")}>
                  <Moon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">Silence the doorbell</p>
                  <p className={cn("text-sm", form.enabled ? "text-white/60" : "text-muted")}>{form.enabled ? `${formatClock(form.start_time)} – ${formatClock(form.end_time)}` : "Chime plays at all hours"}</p>
                </div>
              </div>
              <Switch checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} disabled={!admin} label="Enable quiet hours" />
            </div>
            <div className="relative mt-6">
              <QuietDial start={form.start_time} end={form.end_time} enabled={form.enabled} tz={form.timezone} />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[22px] bg-surface p-4 text-sm shadow-card" role="status">
            {!q ? null : synced ? (
              <>
                <Check className="size-5 shrink-0 text-success" />
                <span>Synced to {device?.device_name ?? "your device"} · {formatDateTime(q.synced_at!, snapshot.household.timezone)}</span>
              </>
            ) : online ? (
              <>
                <LoaderCircle className="size-5 shrink-0 animate-spin" />
                <span>Waiting for {device?.device_name ?? "the device"} to confirm the schedule…</span>
              </>
            ) : (
              <>
                <Clock className="size-5 shrink-0 text-muted" />
                <span>Saved to your account. {device ? `${device.device_name} is offline — it will sync when it reconnects.` : "No device to sync to."} The cloud still silences the chime for every event it processes.</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-5 lg:col-span-7">
          <div className="space-y-5 rounded-card bg-surface p-5 shadow-card">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="start" error={errors.start_time}>
                <Input id="start" type="time" value={form.start_time} disabled={!admin} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </Field>
              <Field label="Ends" htmlFor="end" error={errors.end_time}>
                <Input id="end" type="time" value={form.end_time} disabled={!admin} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </Field>
            </div>
            <div>
              <p className="mb-2 px-1 text-[13px] font-semibold text-muted">Starts on</p>
              <div className="flex justify-between gap-1.5">
                {DAY_LETTERS.map((l, d) => {
                  const on = form.days_of_week.includes(d);
                  return (
                    <button key={d} type="button" disabled={!admin} onClick={() => toggleDay(d)} aria-pressed={on} aria-label={DAY_LABELS[d]} className={cn("flex size-11 items-center justify-center rounded-full text-sm font-bold transition active:scale-95", on ? "bg-ink text-on-ink dark:bg-on-ink dark:text-[#111]" : "bg-surface-2 text-muted")}>
                      {l}
                    </button>
                  );
                })}
              </div>
              {errors.days_of_week && <p className="mt-2 px-1 text-[13px] font-medium text-danger">{errors.days_of_week}</p>}
            </div>
            <Field label="Time zone" htmlFor="tz" error={errors.timezone}>
              <Select id="tz" value={form.timezone} disabled={!admin} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {allZones.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </Select>
            </Field>
            {admin ? (
              <Button block size="lg" disabled={!dirty} loading={saving} onClick={save}>
                {dirty ? "Save schedule" : "Saved"}
              </Button>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
                <Lock className="size-4" /> Only household owners and admins can change quiet hours.
              </p>
            )}
          </div>

          <div className="rounded-card bg-surface p-5 shadow-card">
            <p className="mb-3 font-semibold">Your notifications during quiet hours</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["silent", "Silent alert", "Delivered without sound"],
                  ["hold", "Hold for morning", "Only in the notification centre"],
                ] as const
              ).map(([v, t, d]) => (
                <button key={v} onClick={() => setQuietMode(v)} aria-pressed={prefs.quiet_mode === v} className={cn("rounded-[20px] p-4 text-left ring-2 ring-inset transition", prefs.quiet_mode === v ? "bg-accent-soft ring-accent" : "bg-surface-2 ring-transparent")}>
                  <p className="text-[15px] font-semibold">{t}</p>
                  <p className="text-[13px] text-muted">{d}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-card bg-paper p-5 text-on-paper">
            <p className="mb-3 font-semibold">While quiet hours are on</p>
            <ul className="space-y-2.5 text-[14px]">
              {[
                [BellOff, "The outdoor doorbell doesn't chime — your Dropin is told not to by the cloud."],
                [Moon, "You still get a notification, and every visit is recorded."],
                [Video, "You can still open the camera, talk, and let people in."],
                [ShieldCheck, "Visitors can't turn this off from the doorbell. Only owners and admins can change it."],
              ].map(([Icon, text]) => {
                const I = Icon as typeof Moon;
                return (
                  <li key={text as string} className="flex gap-3">
                    <I className="mt-0.5 size-4 shrink-0" />
                    <span>{text as string}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
