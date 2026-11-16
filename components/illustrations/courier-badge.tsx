import { courierStyle } from "@/lib/domain/couriers";
import { cn } from "@/lib/utils";

export function CourierBadge({ name, className }: { name: string | null | undefined; className?: string }) {
  const s = courierStyle(name);
  return (
    <span
      className={cn("inline-flex size-14 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold tracking-[-0.04em] italic", className)}
      style={{ background: s.bg, color: s.fg }}
      aria-label={name ? `${name}` : "Unidentified courier"}
    >
      {s.short}
    </span>
  );
}
