"use client";

import { Bell, Cpu, Moon, Package, ShieldAlert, Smartphone } from "lucide-react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { errorMessage, useToast } from "@/components/ui/toast";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/domain/permissions";
import { unsubscribeFromPush } from "@/lib/push/browser";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import type { NotificationPrefs } from "@/types/dropin";

export default function NotificationSettingsPage() {
  const { snapshot, run, client } = useHousehold();
  const toast = useToast();
  const prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...snapshot.membership.notification_prefs };
  const { permission: perm, request } = useNotificationPermission();

  const update = async (patch: Partial<NotificationPrefs>) => {
    try {
      await run((c) => c.updateNotificationPrefs({ ...prefs, ...patch }));
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't save", description: errorMessage(e) });
    }
  };

  const togglePush = async (on: boolean) => {
    if (on) {
      const p = await request();
      if (p !== "granted") return toast.push({ tone: "info", title: "Notifications are blocked", description: "Allow them for this site in your browser settings." });
    } else {
      await unsubscribeFromPush().catch(() => {});
      await client.savePushSubscription?.(null).catch(() => {});
    }
    await update({ browser_push: on });
  };

  const rows: { key: keyof NotificationPrefs & ("parcels" | "visitors" | "device" | "security"); icon: typeof Bell; title: string; detail: string }[] = [
    { key: "parcels", icon: Package, title: "Parcels", detail: "Deliveries and collections" },
    { key: "visitors", icon: Bell, title: "Visitors", detail: "Doorbell, people at the door, access requests" },
    { key: "security", icon: ShieldAlert, title: "Security alerts", detail: "Compartment left open, access decisions" },
    { key: "device", icon: Cpu, title: "Device", detail: "Disconnects and reconnects" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/settings" title="Notifications" />
      <div className="space-y-8">
        <section>
          <SectionHeader title="This device" />
          <ListGroup>
            <ListRow icon={Smartphone} title="Push notifications" detail={perm === "unsupported" ? "Not supported in this browser" : perm === "denied" ? "Blocked in browser settings" : prefs.browser_push ? "On for this browser" : "Off"}>
              <Switch checked={prefs.browser_push && perm === "granted"} disabled={perm === "unsupported" || perm === "denied"} onChange={togglePush} label="Push notifications" />
            </ListRow>
          </ListGroup>
        </section>
        <section>
          <SectionHeader title="Notify me about" />
          <ListGroup>
            {rows.map((r) => (
              <ListRow key={r.key} icon={r.icon} title={r.title} detail={r.detail}>
                <Switch checked={prefs[r.key]} onChange={(v) => update({ [r.key]: v })} label={r.title} />
              </ListRow>
            ))}
          </ListGroup>
        </section>
        <section>
          <SectionHeader title="During quiet hours" />
          <ListGroup>
            {(
              [
                ["silent", "Silent alert", "Show the notification without sound"],
                ["hold", "Hold for morning", "Only record it in the notification centre"],
              ] as const
            ).map(([v, t, d]) => (
              <ListRow key={v} icon={Moon} title={t} detail={d} onClick={() => update({ quiet_mode: v })}>
                <span className={`flex size-6 items-center justify-center rounded-full ring-2 ring-inset ${prefs.quiet_mode === v ? "ring-accent" : "ring-surface-3"}`} aria-hidden>
                  {prefs.quiet_mode === v && <span className="size-3 rounded-full bg-accent" />}
                </span>
              </ListRow>
            ))}
          </ListGroup>
          <p className="mt-3 px-1 text-[13px] text-muted">Security alerts always use sound, even during quiet hours.</p>
        </section>
      </div>
    </div>
  );
}
