import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  surface: "bg-surface text-fg shadow-card",
  ink: "bg-ink text-on-ink shadow-card",
  paper: "bg-paper text-on-paper shadow-card",
  accent: "bg-accent text-on-accent shadow-card",
  muted: "bg-surface-2 text-fg",
  outline: "ring-1 ring-inset ring-line text-fg",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof TONES;
  padded?: boolean;
}

export function Card({ tone = "surface", padded = true, className, ...props }: CardProps) {
  return <div className={cn("relative overflow-hidden rounded-card", TONES[tone], padded && "p-5", className)} {...props} />;
}

export function SectionHeader({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3 px-1", className)}>
      <h2 className="text-heading font-semibold">{title}</h2>
      {action}
    </div>
  );
}
