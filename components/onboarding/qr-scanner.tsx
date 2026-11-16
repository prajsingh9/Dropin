"use client";

import { CameraOff, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { parseDeviceQr } from "@/lib/backend/schemas";

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Scans the QR code on the back of the Dropin using the camera and the
 * platform BarcodeDetector. Falls back gracefully where unsupported.
 */
export function QrScanner({ onResult }: { onResult: (r: { device_identifier: string; pairing_code: string }) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "scanning" | "unsupported" | "denied" | "invalid">(() =>
    typeof window !== "undefined" && "BarcodeDetector" in window && typeof navigator.mediaDevices?.getUserMedia === "function" ? "starting" : "unsupported",
  );

  useEffect(() => {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const detector = new Ctor({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setState("scanning");
        timer = setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return;
          try {
            const codes = await detector.detect(video.current);
            for (const c of codes) {
              const parsed = parseDeviceQr(c.rawValue);
              if (parsed) {
                onResult(parsed);
                return;
              }
              setState("invalid");
            }
          } catch {
            /* frame not ready */
          }
        }, 350);
      })
      .catch(() => setState("denied"));
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  const message = {
    starting: "Starting camera…",
    scanning: "Point at the QR code on the back of your Dropin",
    invalid: "That QR code isn't a Dropin pairing code",
    unsupported: "This browser can't scan QR codes. Enter the device ID instead.",
    denied: "Camera access was blocked. Allow it in your browser settings, or enter the ID manually.",
  }[state];

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-card bg-ink text-on-ink">
      <video ref={video} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      {(state === "scanning" || state === "invalid") && (
        <div className="absolute inset-[18%] rounded-[28px] ring-2 ring-white/80" aria-hidden>
          <div className="h-0.5 w-full animate-scan bg-accent shadow-[0_0_16px_#F15A00] [--scan-distance:calc(100%)]" style={{ ["--scan-distance" as string]: "220px" }} />
        </div>
      )}
      {(state === "unsupported" || state === "denied" || state === "starting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          {state === "starting" ? <LoaderCircle className="size-8 animate-spin" /> : <CameraOff className="size-8" strokeWidth={1.6} />}
        </div>
      )}
      <p className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/55 px-4 py-3 text-center text-sm font-medium backdrop-blur-md" role="status">
        {message}
      </p>
    </div>
  );
}
