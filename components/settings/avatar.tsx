import { cn, hashSeed, initials } from "@/lib/utils";

const TONES = ["bg-paper text-on-paper", "bg-accent text-on-accent", "bg-ink text-on-ink", "bg-yellow text-[#111]", "bg-surface-3 text-fg"];

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user-provided avatar (data URL or signed storage URL)
    return <img src={src} alt="" className={cn("size-11 shrink-0 rounded-full object-cover", className)} />;
  }
  return <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold", TONES[hashSeed(name) % TONES.length], className)}>{initials(name)}</span>;
}
