"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Phone, PhoneOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MediaImage } from "@/components/illustrations/media";
import { useDropin } from "@/components/providers/dropin-provider";
import { errorMessage, useToast } from "@/components/ui/toast";
import { formatTime } from "@/lib/domain/format";

/** Full-screen incoming call when someone presses the doorbell. */
export function IncomingVisitor() {
  const { incomingVisitor: v, dismissIncoming, run, snapshot } = useDropin();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"answer" | "decline" | null>(null);

  const respond = async (decision: "answer" | "decline") => {
    if (!v) return;
    setBusy(decision);
    try {
      await run((c) => c.respondToVisitor(v.id, decision));
      dismissIncoming(v.id);
      if (decision === "answer") router.push(`/visitors/live/${v.id}`);
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't respond", description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {v && (
        <motion.div
          key={v.id}
          role="alertdialog"
          aria-label="Someone is at your door"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="pt-safe pb-safe fixed inset-0 z-[80] flex flex-col bg-[#0b0b0a] text-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[640px] sm:w-[380px] sm:overflow-hidden sm:rounded-[36px] sm:shadow-float"
        >
          <div className="absolute inset-0 scale-125 opacity-50 blur-2xl">
            <MediaImage src={v.image_url} kind="visitor" alt="Visitor" label={false} night={v.during_quiet_hours} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/90" />
          <div className="relative flex items-center justify-between p-5">
            <span className="rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-semibold backdrop-blur-md">Front door · {formatTime(v.arrived_at, snapshot?.household.timezone)}</span>
            <button onClick={() => dismissIncoming(v.id)} aria-label="Hide" className="flex size-10 items-center justify-center rounded-full bg-white/12 backdrop-blur-md">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="relative mb-8">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/40" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/30 [animation-delay:0.6s]" />
              <div className="relative size-40 overflow-hidden rounded-full ring-4 ring-white/15">
                <MediaImage src={v.image_url} kind="visitor" alt="Visitor at the door" label={false} night={v.during_quiet_hours} />
              </div>
            </div>
            <h2 className="text-[34px] font-semibold leading-none tracking-[-0.04em]">Someone is at your door</h2>
            <p className="mt-3 text-white/65">{v.visitor_name ? `${v.visitor_name} rang the doorbell` : "Doorbell pressed"}</p>
            {v.during_quiet_hours && (
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-semibold">
                <Moon className="size-4" /> Quiet hours — the chime stayed silent
              </span>
            )}
          </div>
          <div className="relative grid grid-cols-2 gap-6 px-10 pb-10">
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => respond("decline")} disabled={!!busy} aria-label="Decline" className="flex size-[72px] items-center justify-center rounded-full bg-danger text-white transition active:scale-95 disabled:opacity-60">
                <PhoneOff className="size-7" />
              </button>
              <span className="text-sm font-semibold text-white/70">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => respond("answer")} disabled={!!busy} aria-label="Answer" className="flex size-[72px] items-center justify-center rounded-full bg-success text-white transition active:scale-95 disabled:opacity-60">
                <Phone className="size-7" />
              </button>
              <span className="text-sm font-semibold text-white/70">Answer</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
