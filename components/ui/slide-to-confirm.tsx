"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ChevronRight, LoaderCircle, Lock, LockOpen } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Signature Dropin control: drag the lock across to confirm a physical action.
 * Prevents accidental unlocks; also fully keyboard-accessible (Enter / Space).
 */
export function SlideToConfirm({
  label,
  onConfirm,
  disabled,
  pending,
  tone = "glass",
  startIcon = <Lock className="size-5" strokeWidth={2} />,
  endIcon = <LockOpen className="size-5" strokeWidth={2} />,
  className,
}: {
  label: string;
  onConfirm: () => Promise<unknown> | void;
  disabled?: boolean;
  pending?: boolean;
  tone?: "glass" | "surface" | "ink";
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(200);
  const x = useMotionValue(0);
  const progress = useTransform(x, (v) => (max ? v / max : 0));
  const hintOpacity = useTransform(progress, [0, 0.5], [1, 0]);
  const [busy, setBusy] = useState(false);
  const working = busy || pending;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setMax(el.clientWidth - 64);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fire = async () => {
    if (disabled || working) return;
    setBusy(true);
    animate(x, max, { type: "spring", stiffness: 500, damping: 40 });
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30, delay: 0.25 });
    }
  };

  return (
    <div
      ref={track}
      className={cn(
        "relative flex h-16 w-full items-center rounded-full p-1.5",
        tone === "glass" && "bg-white/12 text-white ring-1 ring-inset ring-white/12 backdrop-blur-md",
        tone === "surface" && "bg-surface-2 text-fg",
        tone === "ink" && "bg-ink text-on-ink",
        disabled && "opacity-50",
        className,
      )}
    >
      <motion.span style={{ opacity: hintOpacity }} className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 pl-12 text-[15px] font-semibold">
        <span>{label}</span>
        <span className="flex" aria-hidden>
          {[0, 1, 2].map((i) => (
            <ChevronRight key={i} className="-ml-2 size-4 animate-chevrons" style={{ animationDelay: `${i * 0.18}s` }} strokeWidth={2.5} />
          ))}
        </span>
      </motion.span>
      <div className={cn("pointer-events-none absolute right-1.5 flex size-[52px] items-center justify-center rounded-full", tone === "glass" ? "bg-white/10" : "bg-black/5 dark:bg-white/5")} aria-hidden>
        {endIcon}
      </div>
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled || working}
        drag={disabled || working ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0.02}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() > max * 0.82) void fire();
          else animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void fire();
          }
        }}
        className="relative z-10 flex size-[52px] cursor-grab touch-none items-center justify-center rounded-full bg-ink text-on-ink shadow-float active:cursor-grabbing dark:bg-on-ink dark:text-[#111]"
      >
        {working ? <LoaderCircle className="size-5 animate-spin" /> : startIcon}
      </motion.button>
    </div>
  );
}
