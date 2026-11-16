import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-surface-2 text-fg",
  ink: "bg-ink text-on-ink",
  light: "bg-white text-[#111]",
  glass: "bg-white/14 text-white ring-1 ring-inset ring-white/15 backdrop-blur-md",
  accent: "bg-accent text-on-accent",
  "accent-soft": "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  paper: "bg-paper text-on-paper",
  outline: "ring-1 ring-inset ring-line text-fg",
};

export function Chip({ tone = "neutral", icon, children, className, dot }: { tone?: keyof typeof TONES; icon?: ReactNode; children: ReactNode; className?: string; dot?: "success" | "accent" | "danger" | "muted" }) {
  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold", TONES[tone], className)}>
      {dot && (
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            dot === "success" && "bg-success",
            dot === "accent" && "bg-accent",
            dot === "danger" && "bg-danger",
            dot === "muted" && "bg-muted",
          )}
        />
      )}
      {icon}
      {children}
    </span>
  );
}
