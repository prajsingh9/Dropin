"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityItem } from "@/components/activity/activity-item";
import { useHousehold } from "@/components/providers/dropin-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { ActivityCategory } from "@/types/dropin";
import { dayLabel } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

const FILTERS: { value: ActivityCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "visitors", label: "Visitors" },
  { value: "parcels", label: "Parcels" },
  { value: "security", label: "Security" },
  { value: "device", label: "Device" },
];

export default function ActivityPage() {
  const { snapshot } = useHousehold();
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");
  const tz = snapshot.household.timezone;
  const groups = useMemo(() => {
    const list = snapshot.activities.filter((a) => filter === "all" || a.category === filter);
    const m = new Map<string, typeof list>();
    for (const a of list) {
      const k = dayLabel(a.created_at, tz);
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m.entries()];
  }, [snapshot.activities, filter, tz]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity" eyebrow="Everything your Dropin saw" />
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn("h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition", filter === f.value ? "bg-ink text-on-ink dark:bg-on-ink dark:text-[#111]" : "bg-surface text-muted shadow-card hover:text-fg")}
          >
            {f.label}
          </button>
        ))}
      </div>
      {groups.length ? (
        <div className="space-y-8">
          {groups.map(([day, items]) => (
            <motion.section key={`${filter}-${day}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} aria-label={day}>
              <h2 className="sticky top-0 z-10 -mx-1 mb-3 bg-bg/90 px-1 py-2 text-lg font-semibold tracking-[-0.02em] backdrop-blur-md">{day}</h2>
              <div className="rounded-card bg-surface p-5 pb-0 shadow-card">
                {items.map((a, i) => (
                  <ActivityItem key={a.id} activity={a} snapshot={snapshot} tz={tz} showLine={i < items.length - 1} />
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<History className="size-7" strokeWidth={1.6} />} title="No activity here" description="Events from your Dropin, doorbell and household will appear in this timeline." />
      )}
    </div>
  );
}
