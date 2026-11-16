"use client";

import { motion } from "framer-motion";
import { ChevronLeft, FlaskConical, LoaderCircle, Mic, MicOff, PhoneOff, ShieldCheck, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { VisitorFrame } from "@/components/illustrations/visitor-frame";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { errorMessage, useToast } from "@/components/ui/toast";
import { useVisitorDecision } from "@/components/visitors/access-request-card";
import { useCommand } from "@/hooks/use-command";
import { useNow } from "@/hooks/use-now";
import { cameraProviderFor, type CameraSession, type StreamState } from "@/lib/hardware/camera";
import { formatTime } from "@/lib/domain/format";
import { effectiveVisitorStatus, visitorName } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

function Clock({ tz }: { tz: string }) {
  const t = useNow(1000);
  return <>{t ? `${formatTime(t, tz)}:${String(t.getSeconds()).padStart(2, "0")}` : "--:--"}</>;
}

/** Full-screen live view: video, two-way audio controls, unlock. */
export default function LiveVisitorPage() {
  const { id } = useParams<{ id: string }>();
  const { snapshot, device, run } = useHousehold();
  const router = useRouter();
  const toast = useToast();
  const { decide, busy } = useVisitorDecision();
  const { send, pending } = useCommand();
  const monitor = id === "monitor";
  const visitor = monitor ? undefined : snapshot.visitors.find((v) => v.id === id);
  const status = visitor ? effectiveVisitorStatus(visitor) : null;
  const [stream, setStream] = useState<{ state: StreamState; reason?: string }>({ state: "idle" });
  const [mic, setMic] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const session = useRef<CameraSession | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const answered = useRef(false);
  const tz = snapshot.household.timezone;
  const canView = can(snapshot.membership, "can_view_camera");
  const ended = Boolean(visitor && ["approved", "denied", "declined", "ended", "missed"].includes(status!));

  // Connect to the camera through the abstraction (simulated or real stream).
  useEffect(() => {
    if (!device || !canView || device.connection_status !== "online") return;
    let cancelled = false;
    void cameraProviderFor(device)
      .connect(device.id, { onState: (state, reason) => !cancelled && setStream({ state, reason }) })
      .then((s) => {
        if (cancelled) return s.close();
        session.current = s;
        if (s.stream && video.current) video.current.srcObject = s.stream;
      });
    return () => {
      cancelled = true;
      session.current?.close();
      session.current = null;
    };
  }, [device, canView]);

  // Answer automatically when opened from a notification while ringing.
  useEffect(() => {
    if (visitor && status === "ringing" && !answered.current) {
      answered.current = true;
      void run((c) => c.respondToVisitor(visitor.id, "answer")).catch(() => {});
    }
    if (visitor && status === "answered") answered.current = true;
  }, [visitor, status, run]);

  useEffect(() => {
    if (stream.state !== "live") return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [stream.state]);

  const toggleMic = async () => {
    try {
      await session.current?.setMicrophone(!mic);
      setMic(!mic);
    } catch (e) {
      toast.push({ tone: "error", title: "Microphone unavailable", description: errorMessage(e) });
    }
  };
  const toggleSpeaker = () => {
    session.current?.setSpeaker(!speaker);
    setSpeaker(!speaker);
  };
  const end = async () => {
    session.current?.close();
    if (visitor && (status === "answered" || status === "ringing")) await run((c) => c.respondToVisitor(visitor.id, "end")).catch(() => {});
    router.push(visitor ? `/visitors/${visitor.id}` : "/visitors");
  };

  const simulated = device?.is_simulated;
  const offline = device && device.connection_status !== "online";
  const label = !canView ? "No camera access" : offline ? "Device offline" : stream.state === "connecting" ? "Connecting…" : stream.state === "live" ? (simulated ? "Live · simulated" : "Live") : stream.state === "unavailable" ? "Stream unavailable" : "Idle";
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* video */}
      <div className="absolute inset-0">
        {stream.state === "live" && simulated ? (
          <>
            {/* blurred fill behind the letterboxed 4:3 feed */}
            <div className="absolute inset-0 scale-125 opacity-60 blur-2xl">
              <VisitorFrame seed={visitor?.image_url?.split("/").pop() ?? "porch"} empty={monitor || ended} label={false} night={visitor?.during_quiet_hours} />
            </div>
            <div className="absolute inset-x-0 top-[12%] aspect-[4/3] max-h-[62%] w-full lg:inset-x-[10%] lg:top-[8%] lg:w-[80%]">
              <VisitorFrame seed={visitor?.image_url?.split("/").pop() ?? "porch"} empty={monitor || ended} live label={false} night={visitor?.during_quiet_hours} fit="contain" className="drop-shadow-2xl" />
            </div>
          </>
        ) : (
          <video ref={video} autoPlay playsInline muted={!speaker} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />
      </div>

      <div className="pt-safe relative flex items-center gap-3 px-4 pt-4">
        <button onClick={end} aria-label="Back" className="flex size-12 items-center justify-center rounded-full bg-white/12 ring-1 ring-inset ring-white/15 backdrop-blur-md">
          <ChevronLeft className="size-6" />
        </button>
        <div className="flex h-10 items-center gap-2 rounded-full bg-white/12 px-4 text-[13px] font-semibold backdrop-blur-md" role="status">
          <span className={cn("size-2 rounded-full", stream.state === "live" ? "bg-danger" : "bg-white/40", stream.state === "live" && "animate-pulse")} />
          {label}
          {stream.state === "live" && <span className="tabular-nums text-white/60">{mmss}</span>}
        </div>
        <span className="ml-auto rounded-full bg-black/40 px-3 py-2 font-mono text-[12px] tabular-nums text-white/80 backdrop-blur-md">
          <Clock tz={tz} />
        </span>
      </div>

      {/* centre states */}
      <div className="relative flex flex-1 items-center justify-center px-8 text-center">
        {stream.state === "connecting" && <LoaderCircle className="size-10 animate-spin text-white/80" />}
        {(stream.state === "unavailable" || offline || !canView) && (
          <div className="max-w-sm rounded-[28px] bg-black/55 p-6 backdrop-blur-md">
            <WifiOff className="mx-auto mb-3 size-8" />
            <p className="text-lg font-semibold">{!canView ? "You don't have camera access" : offline ? "Your Dropin is offline" : "Live video isn't available"}</p>
            <p className="mt-1 text-sm text-white/65">{!canView ? "Ask a household admin to enable it." : offline ? "We'll reconnect as soon as it's back." : stream.reason}</p>
          </div>
        )}
      </div>

      {/* bottom */}
      <div className="pb-safe relative mx-auto w-full max-w-lg px-5 pb-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <p className="text-sm text-white/60">{device?.device_name ?? "Front door"}</p>
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em]">{monitor ? "Front door" : visitor ? visitorName(visitor) : "Visitor"}</h1>
          {visitor && <p className="mt-1 text-sm text-white/60">Arrived {formatTime(visitor.arrived_at, tz)}{ended ? " · this visit has ended" : ""}</p>}
          {simulated && stream.state === "live" && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-yellow/90 px-3 py-1 text-[12px] font-bold text-[#111]">
              <FlaskConical className="size-3.5" /> Simulated feed — no audio is transmitted
            </p>
          )}
        </motion.div>

        {!monitor && visitor && !ended && can(snapshot.membership, "can_manage_access") && (
          <SlideToConfirm className="mb-4" label={offline ? "Device offline" : "Slide to unlock door"} disabled={!!offline || !!busy} pending={busy === "approve"} startIcon={<ShieldCheck className="size-5" />} onConfirm={() => decide(visitor, "approve")} />
        )}
        {monitor && can(snapshot.membership, "can_unlock") && snapshot.deviceStates[device?.id ?? ""]?.lock_status === "locked" && (
          <SlideToConfirm className="mb-4" label={offline ? "Device offline" : "Unlock compartment"} disabled={!!offline} pending={pending === "unlock_compartment"} onConfirm={() => send("unlock_compartment", {}, { success: "Compartment unlocked" })} />
        )}

        <div className="flex items-center justify-center gap-5">
          <button onClick={toggleMic} disabled={stream.state !== "live" || monitor} aria-pressed={mic} aria-label={mic ? "Mute microphone" : "Talk to visitor"} className={cn("flex size-16 items-center justify-center rounded-full ring-1 ring-inset ring-white/15 backdrop-blur-md transition disabled:opacity-35", mic ? "bg-white text-[#111]" : "bg-white/12")}>
            {mic ? <Mic className="size-6" /> : <MicOff className="size-6" />}
          </button>
          <button onClick={end} aria-label={monitor ? "Close camera" : "End call"} className="flex size-[76px] items-center justify-center rounded-full bg-danger text-white shadow-float transition active:scale-95">
            <PhoneOff className="size-7" />
          </button>
          <button onClick={toggleSpeaker} disabled={stream.state !== "live"} aria-pressed={speaker} aria-label={speaker ? "Mute visitor" : "Unmute visitor"} className={cn("flex size-16 items-center justify-center rounded-full ring-1 ring-inset ring-white/15 backdrop-blur-md transition disabled:opacity-35", speaker ? "bg-white/12" : "bg-white text-[#111]")}>
            {speaker ? <Volume2 className="size-6" /> : <VolumeX className="size-6" />}
          </button>
        </div>
        {!monitor && visitor && !ended && can(snapshot.membership, "can_manage_access") && (
          <Button variant="ghost" block className="mt-3 !text-white/70 hover:!bg-white/10" disabled={!!busy} onClick={() => decide(visitor, "deny")}>
            Deny entry
          </Button>
        )}
      </div>
    </div>
  );
}
