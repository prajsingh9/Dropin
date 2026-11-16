"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Bell, FlaskConical, Package } from "lucide-react";
import Link from "next/link";
import { ActivityItem } from "@/components/activity/activity-item";
import { DropinLogo } from "@/components/brand/logo";
import { DeviceHero } from "@/components/home/device-hero";
import { QuickActions } from "@/components/home/quick-actions";
import { QuietHoursCard } from "@/components/home/quiet-hours-card";
import { ParcelCard } from "@/components/parcels/parcel-card";
import { useHousehold } from "@/components/providers/dropin-provider";
import { IconLink } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatTime, greeting } from "@/lib/domain/format";
import { firstName, initials } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.7, 0.2, 1] as const } } };

export default function HomePage() {
  const { snapshot, unreadCount, mode } = useHousehold();
  const tz = snapshot.household.timezone;
  const now = useNow(30_000);

  const received = snapshot.parcels.filter((p) => p.status === "received");
  const expected = snapshot.parcels.filter((p) => p.status === "expected").sort((a, b) => String(a.expected_at ?? "9").localeCompare(String(b.expected_at ?? "9")));
  const stack = [...received, ...expected].slice(0, 2);
  const recent = snapshot.activities.slice(0, 4);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.header variants={rise} className="flex items-center justify-between py-2">
        <DropinLogo className="lg:invisible" />
        <div className="flex items-center gap-2">
          {mode === "demo" && (
            <span className="hidden h-9 items-center gap-1.5 rounded-full bg-yellow/25 px-3 text-[12px] font-bold sm:inline-flex">
              <FlaskConical className="size-3.5" /> Demo mode
            </span>
          )}
          <IconLink href="/notifications" className="lg:hidden" label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} badge={unreadCount}>
            <Bell className="size-5" strokeWidth={1.9} />
          </IconLink>
          <Link href="/settings/account" aria-label="Account" className="flex size-11 items-center justify-center rounded-full bg-paper text-sm font-bold text-on-paper lg:hidden">
            {initials(snapshot.user.full_name)}
          </Link>
        </div>
      </motion.header>

      <motion.section variants={rise} className="pb-7 pt-6 lg:pt-2">
        <h1 className="text-display font-semibold">
          {now ? greeting(now, tz) : "Hello"},<br />
          <span className="text-muted">{firstName(snapshot.user.full_name)}.</span>
        </h1>
        <p className="mt-4 text-[15px] font-medium text-muted" suppressHydrationWarning>
          {now ? `${formatDate(now, tz, { weekday: "long", month: "long", day: "numeric" })} · ${formatTime(now, tz)}` : " "}
          {snapshot.household.flat_number ? ` · Flat ${snapshot.household.flat_number}` : ""}
        </p>
      </motion.section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <motion.div variants={rise} className="lg:col-span-7">
          <DeviceHero />
        </motion.div>
        <motion.div variants={rise} className="flex flex-col gap-6 lg:col-span-5">
          <QuickActions />
          <QuietHoursCard />
        </motion.div>

        <motion.section variants={rise} className="lg:col-span-5" aria-label="Parcels">
          <SectionHeader
            title="Parcels"
            action={
              <Link href="/parcels" className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
                All <ArrowUpRight className="size-4" />
              </Link>
            }
          />
          {stack.length ? (
            <div className="relative">
              {stack.map((p, idx) => (
                <ParcelCard key={p.id} parcel={p} tz={tz} highlight={p.status === "expected"} tilt={idx === 0 && stack.length > 1 ? -2.2 : 0} className={idx > 0 ? "relative z-0 -mt-2" : "relative z-10"} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Package className="size-7" strokeWidth={1.6} />} title="No parcels on the way" description="Add a tracking number and we'll match it when the courier drops it in." action={<Link href="/parcels?add=1" className="text-sm font-semibold text-accent">Add expected parcel</Link>} />
          )}
        </motion.section>

        <motion.section variants={rise} className="lg:col-span-7" aria-label="Recent activity">
          <SectionHeader
            title="Recent activity"
            action={
              <Link href="/activity" className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
                History <ArrowUpRight className="size-4" />
              </Link>
            }
          />
          <div className="rounded-card bg-surface p-5 pb-0 shadow-card">
            {recent.length ? recent.map((a, i) => <ActivityItem key={a.id} activity={a} snapshot={snapshot} tz={tz} showLine={i < recent.length - 1} compact />) : <p className="pb-5 text-sm text-muted">Nothing yet — deliveries, visitors and device events will show up here.</p>}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
