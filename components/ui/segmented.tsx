"use client";

import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

/** Pill tab switcher — the "Expected / Received" control. */
export function Segmented<T extends string>({ options, value, onChange, className, tone = "surface" }: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; className?: string; tone?: "surface" | "ink" }) {
  const id = useId();
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-full p-1", tone === "ink" ? "bg-ink" : "bg-surface-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors",
              active ? (tone === "ink" ? "text-on-accent" : "text-on-ink dark:text-[#111]") : tone === "ink" ? "text-on-ink-muted" : "text-muted",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className={cn("absolute inset-0 rounded-full", tone === "ink" ? "bg-accent" : "bg-ink dark:bg-on-ink")}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              {o.label}
              {o.count ? <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-white/20" : "bg-surface-3")}>{o.count}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
