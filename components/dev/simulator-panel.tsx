"use client";

import { FlaskConical, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Sheet } from "@/components/ui/sheet";
import { errorMessage, useToast } from "@/components/ui/toast";
import { isSimulatorEnabled } from "@/lib/config";
import { SIMULATION_ACTIONS, type SimulationActionId } from "@/lib/simulation/scenarios";
import type { DeviceEventResponse } from "@/lib/domain/processor";
import { cn } from "@/lib/utils";

/**
 * Developer-only hardware simulator. Hidden in production builds unless
 * NEXT_PUBLIC_ENABLE_SIMULATOR=true. Events go through the real processing
 * pipeline and only target devices flagged as simulated.
 */
export function SimulatorPanel({ className }: { className?: string }) {
  const { run, device, snapshot } = useHousehold();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<SimulationActionId | null>(null);
  const [last, setLast] = useState<{ action: string; res: DeviceEventResponse } | null>(null);

  if (!isSimulatorEnabled) return null;

  const fire = async (action: SimulationActionId, label: string) => {
    if (!device) return;
    setBusy(action);
    try {
      const res = await run((c) => c.simulate(action, device.id, snapshot));
      setLast({ action: label, res });
      if (action === "doorbell_pressed" || action === "visitor_detected" || action === "access_requested") setOpen(false);
    } catch (e) {
      toast.push({ tone: "error", title: "Simulation failed", description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const groups = [...new Set(SIMULATION_ACTIONS.map((a) => a.group))];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open hardware simulator"
        className={cn("fixed right-4 z-30 flex h-11 items-center gap-2 rounded-full bg-yellow px-4 text-[13px] font-bold text-[#111] shadow-float transition active:scale-95 lg:bottom-6 lg:right-6", "bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)]", className)}
      >
        <FlaskConical className="size-4" strokeWidth={2.2} />
        Simulate
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Hardware simulator" description="Developer tool. Sends normalized device events through the same pipeline as Dropin firmware.">
        {!device ? (
          <p className="text-sm text-muted">Pair a device first.</p>
        ) : !device.is_simulated ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">{device.device_name} is real hardware ({device.device_identifier}). The simulator only drives devices paired with a SIM- identifier.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
              <span className="font-semibold">{device.device_identifier}</span>
              <span className={cn("font-semibold", device.connection_status === "online" ? "text-success" : "text-muted")}>{device.connection_status}</span>
            </div>
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">{g}</p>
                <div className="grid grid-cols-2 gap-2">
                  {SIMULATION_ACTIONS.filter((a) => a.group === g).map((a) => (
                    <button
                      key={a.id}
                      disabled={!!busy}
                      onClick={() => fire(a.id, a.label)}
                      className="flex min-h-12 items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-left text-[14px] font-semibold transition hover:bg-surface-3 active:scale-[0.98] disabled:opacity-50"
                    >
                      {a.label}
                      {busy === a.id && <LoaderCircle className="size-4 shrink-0 animate-spin" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {last && (
              <div className="rounded-2xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-on-ink">
                <p className="mb-1 font-sans text-[13px] font-semibold">Device response · {last.action}</p>
                <p>chime: {String(last.res.chime)}</p>
                <p>quiet_hours_active: {String(last.res.quiet_hours_active)}</p>
                {last.res.visitor_id && <p>visitor_id: {last.res.visitor_id.slice(0, 8)}…</p>}
                {last.res.parcel_id && <p>parcel_id: {last.res.parcel_id.slice(0, 8)}…</p>}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
