import { useId } from "react";
import { cn, hashSeed } from "@/lib/utils";

const COATS = ["#C2410C", "#1F3A5F", "#3F3F46", "#4D7C0F", "#7C2D12", "#B45309", "#0F766E"];
const SKIN = ["#8D5B3C", "#C68B5E", "#E0AC82", "#5A3A26", "#A86F4C"];
const HAIR = ["#1B1B1B", "#3B2A1E", "#6B4A2E", "#2A2A2A"];

/**
 * Generated stand-in for the doorbell camera — a wide-angle porch scene with
 * a silhouetted visitor. Used only for simulated devices; always watermarked.
 */
export function VisitorFrame({ seed, className, label = true, night, live, empty, fit = "cover", children }: { seed: string; className?: string; label?: boolean; night?: boolean; live?: boolean; empty?: boolean; fit?: "cover" | "contain"; children?: React.ReactNode }) {
  const id = useId().replace(/:/g, "");
  const h = hashSeed(seed);
  const coat = COATS[h % COATS.length]!;
  const skin = SKIN[(h >> 2) % SKIN.length]!;
  const hair = HAIR[(h >> 4) % HAIR.length]!;
  const offset = ((h >> 6) % 60) - 30;
  const cap = (h >> 8) % 3 === 0;
  const box = (h >> 9) % 3 === 0;
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"} className={cn("h-full w-full", className)} role="img" aria-label="Doorbell camera view (simulated)">
      <defs>
        <linearGradient id={`wall-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#1d2430" : "#B9B2A6"} />
          <stop offset="1" stopColor={night ? "#0c0f14" : "#7F786C"} />
        </linearGradient>
        <radialGradient id={`lens-${id}`} cx="0.5" cy="0.45" r="0.72">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`lamp-${id}`} cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#FFE2B8" stopOpacity={night ? 0.35 : 0.2} />
          <stop offset="1" stopColor="#FFE2B8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#wall-${id})`} />
      {/* corridor perspective */}
      <path d="M0 300 L120 200 L280 200 L400 300 Z" fill={night ? "#0a0c10" : "#5E584E"} />
      <path d="M120 200 L120 40 L280 40 L280 200 Z" fill={night ? "#151a22" : "#9C9488"} />
      <rect x="150" y="70" width="100" height="130" rx="3" fill={night ? "#0f1218" : "#6E675B"} />
      <rect width="400" height="300" fill={`url(#lamp-${id})`} />
      {/* visitor */}
      {!empty && <g transform={`translate(${200 + offset} 0)`}>
        <g>
          {live && <animateTransform attributeName="transform" type="translate" values="0 0; 3 -1; -2 0; 0 0" dur="5s" repeatCount="indefinite" />}
          <path d="M-95 300 C-92 230 -60 205 0 200 C60 205 92 230 95 300 Z" fill={coat} />
          <path d="M-22 205 L0 232 L22 205 Z" fill="#000" opacity="0.18" />
          <rect x="-15" y="172" width="30" height="34" rx="10" fill={skin} />
          <ellipse cx="0" cy="140" rx="40" ry="48" fill={skin} />
          <path d="M-41 132 C-42 92 42 92 41 132 C36 110 -36 110 -41 132 Z" fill={hair} />
          {cap && <path d="M-44 118 C-40 86 40 86 44 118 L62 124 L-44 124 Z" fill={coat} />}
          <ellipse cx="0" cy="146" rx="40" ry="48" fill="#000" opacity={night ? 0.45 : 0.12} />
          {box && (
            <g transform="translate(-58 222) rotate(-6)">
              <rect width="78" height="56" rx="4" fill="#C99A61" />
              <rect x="33" width="12" height="56" fill="#AD7F4A" />
            </g>
          )}
        </g>
      </g>}
      <rect width="400" height="300" fill={`url(#lens-${id})`} />
      {night && <rect width="400" height="300" fill="#7FA3FF" opacity="0.06" />}
      {children}
      {label && (
        <g fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="11" fill="#fff">
          <rect x="300" y="270" width="88" height="20" rx="10" fill="#000" opacity="0.45" />
          <text x="313" y="284" opacity="0.8">SIMULATED</text>
        </g>
      )}
    </svg>
  );
}
