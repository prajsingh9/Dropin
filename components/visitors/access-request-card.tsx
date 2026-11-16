"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MediaImage } from "@/components/illustrations/media";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { errorMessage, useToast } from "@/components/ui/toast";
import type { Visitor } from "@/types/dropin";
import { formatTime, relativeTime } from "@/lib/domain/format";
import { REQUEST_TYPE_LABEL, visitorName } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";

export function useVisitorDecision() {
  const { run } = useHousehold();
  const toast = useToast();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const decide = async (v: Visitor, decision: "approve" | "deny") => {
    setBusy(decision);
    try {
      const { command } = await run((c) => c.respondToVisitor(v.id, decision));
      const confirmed = command?.status === "completed";
      toast.push({
        tone: decision === "approve" ? "success" : "info",
        title: decision === "approve" ? "Access granted" : "Access denied",
        description: confirmed ? (decision === "approve" ? `${visitorName(v)} can come in.` : "The visitor has been turned away.") : "Waiting for the device to confirm.",
      });
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't send your decision", description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  return { decide, busy };
}

export function AccessRequestCard({ visitor, tz }: { visitor: Visitor; tz?: string }) {
  const { snapshot } = useHousehold();
  const { decide, busy } = useVisitorDecision();
  const allowed = can(snapshot.membership, "can_manage_access");
  return (
    <div className="overflow-hidden rounded-card bg-ink text-on-ink shadow-card">
      <Link href={`/visitors/${visitor.id}`} className="relative block aspect-[16/10]">
        <MediaImage src={visitor.image_url} kind="visitor" alt={visitorName(visitor)} night={visitor.during_quiet_hours} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16">
          <span className="rounded-full bg-yellow px-2.5 py-1 text-[12px] font-bold text-[#111]">{REQUEST_TYPE_LABEL[visitor.request_type]}</span>
          <p className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">{visitorName(visitor)} wants access</p>
          <p className="text-sm text-white/65">
            {formatTime(visitor.arrived_at, tz)} · {relativeTime(visitor.arrived_at)}
          </p>
        </div>
      </Link>
      <div className="grid grid-cols-2 gap-3 p-4">
        <Button variant="surface" className="!bg-white/10 !text-white !shadow-none" icon={<X className="size-5" />} loading={busy === "deny"} disabled={!allowed || !!busy} onClick={() => decide(visitor, "deny")}>
          Deny
        </Button>
        <Button variant="accent" icon={<Check className="size-5" />} loading={busy === "approve"} disabled={!allowed || !!busy} onClick={() => decide(visitor, "approve")}>
          Approve
        </Button>
      </div>
      {!allowed && <p className="px-4 pb-4 text-center text-xs text-on-ink-muted">You don&apos;t have permission to approve visitors.</p>}
    </div>
  );
}
