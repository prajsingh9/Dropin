"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Archive, Inbox, Plus, Truck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AddParcelSheet } from "@/components/parcels/add-parcel-sheet";
import { ParcelCard } from "@/components/parcels/parcel-card";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import type { ParcelStatus } from "@/types/dropin";

const TABS: ParcelStatus[] = ["expected", "received", "collected"];

function ParcelsView() {
  const { snapshot } = useHousehold();
  const params = useSearchParams();
  const router = useRouter();
  const tabParam = params.get("tab") as ParcelStatus | null;
  const tab: ParcelStatus = tabParam && TABS.includes(tabParam) ? tabParam : snapshot.parcels.some((p) => p.status === "received") ? "received" : "expected";
  const adding = params.get("add") === "1";
  const tz = snapshot.household.timezone;

  const setParams = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.replace(`/parcels${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const byStatus = (s: ParcelStatus) => snapshot.parcels.filter((p) => p.status === s);
  const list = byStatus(tab).sort((a, b) => {
    const key = (p: typeof a) => (tab === "expected" ? p.expected_at ?? "9999" : tab === "received" ? p.deposited_at ?? "" : p.collected_at ?? "");
    return tab === "expected" ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a));
  });

  const empty = {
    expected: { icon: <Truck className="size-7" strokeWidth={1.6} />, title: "Nothing on the way", description: "Add an order's tracking number and we'll match it when it's dropped in.", action: <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setParams({ add: "1" })}>Expect a parcel</Button> },
    received: { icon: <Inbox className="size-7" strokeWidth={1.6} />, title: "Compartment's empty", description: "When a courier drops something in, it shows up here with a photo." },
    collected: { icon: <Archive className="size-7" strokeWidth={1.6} />, title: "No history yet", description: "Collected parcels are kept here for your records." },
  }[tab];

  return (
    <>
      <PageHeader
        title={
          <>
            Your
            <br />
            parcels
          </>
        }
        actions={
          <IconButton label="Expect a parcel" variant="ink" size="lg" onClick={() => setParams({ add: "1" })}>
            <Plus className="size-6" />
          </IconButton>
        }
        back={undefined}
      />
      <Segmented
        className="mb-6 max-w-lg"
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        options={[
          { value: "expected", label: "Expected", count: byStatus("expected").length },
          { value: "received", label: "Received", count: byStatus("received").length },
          { value: "collected", label: "Collected" },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {list.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <ParcelCard parcel={p} tz={tz} highlight={tab === "expected" && i === 0} />
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState {...empty} />
          )}
        </motion.div>
      </AnimatePresence>
      <AddParcelSheet open={adding} onClose={() => setParams({ add: null })} />
    </>
  );
}

export default function ParcelsPage() {
  return (
    <Suspense>
      <ParcelsView />
    </Suspense>
  );
}
