"use client";

import { History, Moon, ShieldAlert, Users } from "lucide-react";
import { ActivityItem } from "@/components/activity/activity-item";
import { useHousehold } from "@/components/providers/dropin-provider";
import { SectionHeader } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { describeDays, formatClock } from "@/lib/domain/quiet-hours";

export default function SecurityPage() {
  const { snapshot } = useHousehold();
  const q = snapshot.quietHours;
  const recent = snapshot.activities.filter((a) => a.category === "security").slice(0, 5);
  const tz = snapshot.household.timezone;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/settings" title="Security" eyebrow="Privacy & access" />
      <div className="space-y-8">
        <ListGroup>
          <ListRow icon={Moon} title="Quiet hours" detail={q?.enabled ? `${formatClock(q.start_time)} – ${formatClock(q.end_time)} · ${describeDays(q.days_of_week)}` : "Off"} href="/device/quiet-hours" />
          <ListRow icon={Users} title="Access permissions" detail="Who can unlock, view the camera and approve visitors" href="/settings/household#members" />
          <ListRow icon={History} title="Visitor history" detail={`${snapshot.visitors.length} recorded visits`} href="/visitors" />
          <ListRow icon={ShieldAlert} title="Security alerts" detail={snapshot.membership.notification_prefs?.security === false ? "Off" : "On"} href="/settings/notifications" />
        </ListGroup>
        <div className="rounded-card bg-paper p-5 text-sm text-on-paper">
          <p className="mb-1 font-semibold">How Dropin protects your home</p>
          <p className="opacity-80">Camera snapshots and visitor history are visible only to members of {snapshot.household.name} with camera access. Every unlock and access decision is recorded below, with who made it.</p>
        </div>
        <section>
          <SectionHeader title="Recent security events" />
          <div className="rounded-card bg-surface p-5 pb-0 shadow-card">
            {recent.length ? recent.map((a, i) => <ActivityItem key={a.id} activity={a} snapshot={snapshot} tz={tz} showLine={i < recent.length - 1} compact />) : <p className="pb-5 text-sm text-muted">No security events yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
