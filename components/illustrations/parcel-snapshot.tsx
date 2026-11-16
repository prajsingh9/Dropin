import { useId } from "react";
import { cn, hashSeed } from "@/lib/utils";

/**
 * Generated stand-in for the compartment camera's parcel photo. Rendered only
 * for simulated devices (`sim://parcel/<seed>`), and always watermarked.
 */
export function ParcelSnapshot({ seed, className, label = true }: { seed: string; className?: string; label?: boolean }) {
  const id = useId().replace(/:/g, "");
  const h = hashSeed(seed);
  const rot = (h % 24) - 12;
  const w = 120 + (h % 50);
  const d = 80 + ((h >> 3) % 40);
  const tones = [
    ["#D2A46B", "#B98848", "#E6C08A"],
    ["#C79B63", "#A97B44", "#DDB27B"],
    ["#E5D9C3", "#C9BBA2", "#F1E8D8"],
    ["#2B2B2B", "#1A1A1A", "#3A3A3A"],
    ["#E5B928", "#C49A12", "#F0CC4E"],
  ][h % 5]!;
  return (
    <svg viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" className={cn("h-full w-full", className)} role="img" aria-label="Parcel photo from the compartment camera (simulated)">
      <defs>
        <radialGradient id={`v-${id}`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#4A3A2C" />
          <stop offset="0.7" stopColor="#1A1512" />
          <stop offset="1" stopColor="#070707" />
        </radialGradient>
      </defs>
      <rect width="320" height="240" fill={`url(#v-${id})`} />
      <path d="M30 230 L60 40 L260 40 L290 230 Z" fill="#000" opacity="0.25" />
      <g transform={`translate(160 130) rotate(${rot})`}>
        <ellipse cx="6" cy={d / 2 + 14} rx={w / 1.7} ry="16" fill="#000" opacity="0.45" />
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx="5" fill={tones[0]} />
        <rect x={-w / 2} y={-d / 2} width={w} height={d * 0.22} rx="5" fill={tones[2]} opacity="0.6" />
        <rect x={-10} y={-d / 2} width="20" height={d} fill={tones[1]} opacity="0.55" />
        <rect x={w / 2 - 54} y={d / 2 - 34} width="42" height="26" rx="2" fill="#F7F4EE" />
        <rect x={w / 2 - 50} y={d / 2 - 29} width="26" height="3" fill="#222" />
        <rect x={w / 2 - 50} y={d / 2 - 23} width="32" height="2" fill="#555" />
        <rect x={w / 2 - 50} y={d / 2 - 18} width="20" height="2" fill="#555" />
      </g>
      {label && (
        <g fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="10" fill="#fff">
          <rect x="10" y="10" width="92" height="18" rx="9" fill="#000" opacity="0.5" />
          <circle cx="21" cy="19" r="3" fill="#F15A00" />
          <text x="29" y="22.5" opacity="0.85">COMPARTMENT</text>
          <rect x="230" y="212" width="80" height="18" rx="9" fill="#000" opacity="0.5" />
          <text x="241" y="224.5" opacity="0.75">SIMULATED</text>
        </g>
      )}
    </svg>
  );
}
