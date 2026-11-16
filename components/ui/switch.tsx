"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Switch({ checked, onChange, label, disabled, tone = "accent" }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; tone?: "accent" | "ink" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-1 transition-colors duration-200 disabled:opacity-40",
        checked ? (tone === "accent" ? "bg-accent" : "bg-ink dark:bg-on-ink") : "bg-surface-3",
        checked ? "justify-end" : "justify-start",
      )}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 35 }} className="size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)]" />
    </button>
  );
}
