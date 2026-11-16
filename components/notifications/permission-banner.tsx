"use client";

import { BellRing } from "lucide-react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { errorMessage, useToast } from "@/components/ui/toast";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/domain/permissions";
import { useNotificationPermission } from "@/hooks/use-notification-permission";

/** Asks for notification permission only after the user taps — never on page load. */
export function PermissionBanner() {
  const { snapshot, run } = useHousehold();
  const toast = useToast();
  const { permission: perm, request } = useNotificationPermission();
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...snapshot.membership.notification_prefs };

  if (perm === "unsupported" || (perm === "granted" && prefs.browser_push)) return null;

  const enable = async () => {
    const p = await request();
    if (p !== "granted") return toast.push({ tone: "info", title: "Notifications are blocked", description: "Enable them for this site in your browser settings." });
    try {
      await run((c) => c.updateNotificationPrefs({ ...prefs, browser_push: true }));
      toast.push({ tone: "success", title: "Alerts on for this device" });
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't save", description: errorMessage(e) });
    }
  };

  return (
    <div className="mb-6 flex items-center gap-4 rounded-card bg-paper p-4 text-on-paper">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
        <BellRing className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{perm === "denied" ? "Notifications are blocked" : "Get alerts on this device"}</p>
        <p className="text-sm opacity-70">{perm === "denied" ? "Allow them in your browser's site settings to hear about visitors." : "Know the moment a parcel lands or someone rings."}</p>
      </div>
      {perm !== "denied" && (
        <Button size="sm" onClick={enable}>
          Turn on
        </Button>
      )}
    </div>
  );
}
