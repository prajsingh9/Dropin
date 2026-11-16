"use client";

import { motion } from "framer-motion";
import { ScanFace, Video } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { VisitorFrame } from "@/components/illustrations/visitor-frame";
import { useHousehold } from "@/components/providers/dropin-provider";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { AccessRequestCard } from "@/components/visitors/access-request-card";
import { VisitorRow } from "@/components/visitors/visitor-row";
import { dayLabel } from "@/lib/domain/format";
import { effectiveVisitorStatus } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";

type Filter = "all" | "missed" | "access";

export default function VisitorsPage() {
  const { snapshot, device } = useHousehold();
  const [filter, setFilter] = useState<Filter>("all");
  const tz = snapshot.household.timezone;
  const canView = can(snapshot.membership, "can_view_camera");
  const pending = snapshot.visitors.filter((v) => effectiveVisitorStatus(v) === "pending");
  const history = snapshot.visitors.filter((v) => {
    const s = effectiveVisitorStatus(v);
    if (filter === "missed") return s === "missed";
    if (filter === "access") return v.request_type !== "doorbell";
    return s !== "pending";
  });
  const groups = useMemo(() => {
    const m = new Map<string, typeof history>();
    for (const v of history) {
      const k = dayLabel(v.arrived_at, tz);
      m.set(k, [...(m.get(k) ?? []), v]);
    }
    return [...m.entries()];
  }, [history, tz]);
  const online = device?.connection_status === "online";

  return (
    <>
      <PageHeader
        title={
          <>
            Who&apos;s at
            <br />
            the door
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-5">
          <Link href="/visitors/live/monitor" className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-ink shadow-card" aria-label="Open the front door camera">
            <VisitorFrame seed="porch" empty label={false} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur-md">
              <span className={`size-2 rounded-full ${online ? "bg-danger" : "bg-white/40"}`} /> {online ? "Front door" : "Camera offline"}
            </div>
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-white">
              <div>
                <p className="text-sm text-white/65">{device?.device_name ?? "Doorbell"}</p>
                <p className="text-[24px] font-semibold tracking-[-0.03em]">View camera</p>
              </div>
              <span className="flex size-14 items-center justify-center rounded-full bg-accent transition group-hover:scale-105">
                <Video className="size-6" />
              </span>
            </div>
          </Link>

          {pending.length > 0 && (
            <section aria-label="Access requests">
              <SectionHeader title="Waiting for you" />
              <div className="space-y-4">
                {pending.map((v) => (
                  <AccessRequestCard key={v.id} visitor={v} tz={tz} />
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="lg:col-span-7" aria-label="Visitor history">
          <Segmented
            className="mb-5"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "missed", label: "Missed" },
              { value: "access", label: "Access" },
            ]}
          />
          {!canView ? (
            <EmptyState icon={<ScanFace className="size-7" />} title="Camera access is off" description="Ask a household admin to let you view the doorbell camera and visitor history." />
          ) : groups.length ? (
            <div className="space-y-6">
              {groups.map(([day, items]) => (
                <div key={day}>
                  <p className="mb-3 px-1 text-sm font-semibold text-muted">{day}</p>
                  <div className="space-y-3">
                    {items.map((v, i) => (
                      <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                        <VisitorRow visitor={v} tz={tz} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<ScanFace className="size-7" strokeWidth={1.6} />} title={filter === "missed" ? "No missed visitors" : "No visitors yet"} description="When someone rings or is detected at your door, they'll appear here with a snapshot." />
          )}
        </section>
      </div>
    </>
  );
}
