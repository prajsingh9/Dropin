"use client";

import { Bug, ChevronDown, Copy, LifeBuoy, Mail, Wrench } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

const FAQ = [
  ["What happens if I'm not home when a parcel arrives?", "The courier drops it into the compartment, which locks automatically. You get a notification with a photo, and it stays locked until someone in your household unlocks it."],
  ["Can a visitor turn off quiet hours?", "No. Quiet hours live in your account, and the cloud tells the doorbell whether it may chime. Only household owners and admins can change them in the app."],
  ["What if the courier isn't recognised?", "The parcel is still recorded as received with a photo and timestamp — it's just marked “courier unknown”."],
  ["Who can see my camera?", "Only members of your household with camera access. Admins can change this per person in Household → Members."],
  ["My Dropin shows offline", "Parcels stay locked while offline. Check the power and Wi-Fi, then see troubleshooting below. Settings you change are queued and sync when it reconnects."],
];

const TROUBLESHOOT = [
  { title: "Device offline", steps: ["Check the green light on the camera module.", "Make sure your router is on and within range.", "Restart the device from Device → Restart (when online), or unplug it for 10 seconds."] },
  { title: "Compartment won't unlock", steps: ["Make sure the device is online.", "Close the door fully, then try again.", "Check that your account has unlock permission."] },
  { title: "No doorbell sound", steps: ["Check whether quiet hours are active.", "Make sure the outdoor chime is on in Device settings.", "Turn the volume up and ring once to test."] },
];

export default function SupportPage() {
  const { snapshot, device, mode } = useHousehold();
  const toast = useToast();
  const [category, setCategory] = useState("Device");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");

  const diagnostics = [
    `Mode: ${mode}`,
    `Device: ${device ? `${device.device_identifier} (${device.connection_status}, fw ${device.firmware_version ?? "?"})` : "none"}`,
    `Simulated: ${device?.is_simulated ? "yes" : "no"}`,
    `Household: ${snapshot.household.id}`,
    `Browser: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
  ].join("\n");

  const report = async (e: FormEvent) => {
    e.preventDefault();
    if (details.trim().length < 10) return setError("Tell us a little more (at least 10 characters).");
    setError("");
    const body = `${details.trim()}\n\n— Diagnostics —\n${diagnostics}`;
    if (SUPPORT_EMAIL) {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[Dropin] ${category} problem`)}&body=${encodeURIComponent(body)}`;
    } else {
      await navigator.clipboard?.writeText(body).catch(() => {});
      toast.push({ tone: "success", title: "Report copied", description: "No support inbox is configured for this deployment — paste it wherever your team tracks issues." });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/settings" title="Support" eyebrow="We're here to help" />
      <div className="space-y-8">
        <section>
          <SectionHeader title="Help centre" />
          <div className="space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-[22px] bg-surface shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold">
                  {q}
                  <ChevronDown className="size-5 shrink-0 text-muted transition group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-4 text-[14px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Device troubleshooting" />
          <div className="grid gap-3 sm:grid-cols-3">
            {TROUBLESHOOT.map((t) => (
              <div key={t.title} className="rounded-card bg-surface p-5 shadow-card">
                <Wrench className="mb-3 size-5 text-accent" />
                <p className="font-semibold">{t.title}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-muted">
                  {t.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <Link href="/device" className="mt-3 inline-flex text-sm font-semibold text-accent">
            Open device status →
          </Link>
        </section>

        <section>
          <SectionHeader title="Report a problem" />
          <form onSubmit={report} className="space-y-4 rounded-card bg-surface p-5 shadow-card" noValidate>
            <Field label="What's it about?" htmlFor="cat">
              <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {["Device", "Parcels", "Visitors & doorbell", "Notifications", "Account", "Something else"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="What happened?" htmlFor="det" error={error}>
              <Textarea id="det" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you expect, and what happened instead?" aria-invalid={!!error} />
            </Field>
            <details className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px]">
              <summary className="cursor-pointer font-semibold">Diagnostics included</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[12px] text-muted">{diagnostics}</pre>
            </details>
            <Button type="submit" block icon={SUPPORT_EMAIL ? <Bug className="size-4" /> : <Copy className="size-4" />}>
              {SUPPORT_EMAIL ? "Send report" : "Copy report"}
            </Button>
          </form>
        </section>

        <section className="flex items-center gap-4 rounded-card bg-ink p-5 text-on-ink">
          <LifeBuoy className="size-8 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Contact support</p>
            <p className="text-sm text-on-ink-muted">{SUPPORT_EMAIL ? SUPPORT_EMAIL : "Set NEXT_PUBLIC_SUPPORT_EMAIL to show your support inbox here."}</p>
          </div>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="flex size-11 items-center justify-center rounded-full bg-white/10" aria-label="Email support">
              <Mail className="size-5" />
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
