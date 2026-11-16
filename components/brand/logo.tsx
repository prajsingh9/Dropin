import { cn } from "@/lib/utils";

/** Dropin mark: the collector's silhouette with its parcel slot and an accent drop. */
export function DropinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect x="6" y="3" width="20" height="26" rx="6" fill="currentColor" />
      <rect x="9.5" y="7" width="13" height="10" rx="2.5" fill="var(--bg, #F4F1EB)" opacity="0.92" />
      <circle cx="16" cy="23" r="2.4" fill="#F15A00" />
    </svg>
  );
}

export function DropinLogo({ className, withMark = true }: { className?: string; withMark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[22px] font-bold leading-none tracking-[-0.05em]", className)} aria-label="Dropin">
      {withMark && <DropinMark className="size-[1.15em]" />}
      <span aria-hidden>
        dropin<span className="text-accent">.</span>
      </span>
    </span>
  );
}
