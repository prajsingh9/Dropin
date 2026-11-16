"use client";

import { BellOff, CheckCheck, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NotificationItem } from "@/components/notifications/notification-item";
import { PermissionBanner } from "@/components/notifications/permission-banner";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button, IconLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { errorMessage, useToast } from "@/components/ui/toast";
import type { AppNotification } from "@/types/dropin";
import { dayLabel } from "@/lib/domain/format";

export default function NotificationsPage() {
  const { snapshot, run, unreadCount } = useHousehold();
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState(false);
  const tz = snapshot.household.timezone;

  const groups = useMemo(() => {
    const list = snapshot.notifications.filter((n) => filter === "all" || !n.read_at);
    const m = new Map<string, AppNotification[]>();
    for (const n of list) {
      const k = dayLabel(n.created_at, tz);
      m.set(k, [...(m.get(k) ?? []), n]);
    }
    return [...m.entries()];
  }, [snapshot.notifications, filter, tz]);

  const open = async (n: AppNotification) => {
    if (!n.read_at) void run((c) => c.markNotificationsRead([n.id])).catch(() => {});
    if (n.action_url) router.push(n.action_url);
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await run((c) => c.markNotificationsRead("all"));
      toast.push({ tone: "success", title: "All caught up" });
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't mark as read", description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back="/home"
        title="Notifications"
        eyebrow={unreadCount ? `${unreadCount} unread` : "You're all caught up"}
        actions={
          <IconLink href="/settings/notifications" label="Notification settings" variant="outline">
            <SlidersHorizontal className="size-5" />
          </IconLink>
        }
      />
      <PermissionBanner />
      <div className="mb-5 flex items-center gap-3">
        <Segmented
          className="flex-1"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread", count: unreadCount },
          ]}
        />
        <Button variant="surface" icon={<CheckCheck className="size-4" />} onClick={markAll} loading={busy} disabled={!unreadCount}>
          <span className="hidden sm:inline">Mark all read</span>
        </Button>
      </div>
      {groups.length ? (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{day}</h2>
              <div className="space-y-2">
                {items.map((n) => (
                  <NotificationItem key={n.id} n={n} tz={tz} onOpen={open} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<BellOff className="size-7" strokeWidth={1.6} />} title={filter === "unread" ? "Nothing unread" : "No notifications yet"} description="Parcel drops, visitors and device alerts will appear here." />
      )}
    </div>
  );
}
