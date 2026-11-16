"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import type { CompartmentVisual } from "@/lib/domain/device-state";
import { cn } from "@/lib/utils";

/**
 * Illustrated Dropin Parcel Collector, modelled on the product renders:
 * warm off-white matte body, black camera module with status LEDs, dark
 * parcel door with a bar handle, lower panel with a physical button.
 */
export function DropinDevice({ state, className }: { state: CompartmentVisual; className?: string }) {
  const id = useId().replace(/:/g, "");
  const open = state === "open";
  const hasParcel = state === "deposited" || state === "awaiting" || state === "open";
  const dim = state === "offline" || state === "pending";
  const led = state === "error" ? "#FF4A2E" : dim ? "#555" : hasParcel ? "#F15A00" : "#3DDC84";

  return (
    <svg viewBox="0 0 220 380" className={cn("h-full w-auto", className)} role="img" aria-label={`Dropin collector — ${state}`}>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#F4F1EC" />
          <stop offset="0.65" stopColor="#E3DFD7" />
          <stop offset="1" stopColor="#BDB8AE" />
        </linearGradient>
        <linearGradient id={`side-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#8E8A82" />
          <stop offset="1" stopColor="#5B5852" />
        </linearGradient>
        <linearGradient id={`door-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A4A48" />
          <stop offset="0.55" stopColor="#262625" />
          <stop offset="1" stopColor="#151515" />
        </linearGradient>
        <radialGradient id={`inside-${id}`} cx="0.5" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#3B2A1E" />
          <stop offset="1" stopColor="#0B0B0B" />
        </radialGradient>
        <radialGradient id={`glow-${id}`}>
          <stop offset="0" stopColor="#F15A00" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F15A00" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* floor shadow */}
      <ellipse cx="112" cy="364" rx="92" ry="11" fill="#000" opacity="0.18" />

      <g opacity={dim ? 0.72 : 1} style={{ filter: state === "error" ? "saturate(0.6)" : undefined }}>
        {/* side depth */}
        <path d="M178 46 L196 54 L196 350 L178 356 Z" fill={`url(#side-${id})`} />
        {/* body */}
        <rect x="24" y="40" width="160" height="318" rx="26" fill={`url(#body-${id})`} />
        <rect x="24" y="40" width="160" height="318" rx="26" fill="none" stroke="#fff" strokeOpacity="0.5" />

        {/* camera module */}
        <path d="M44 18 h120 a10 10 0 0 1 10 10 v18 h-140 v-18 a10 10 0 0 1 10 -10 z" fill="#161616" />
        <rect x="40" y="40" width="128" height="6" rx="2" fill="#0d0d0d" />
        <circle cx="104" cy="31" r="6.5" fill="#050505" stroke="#2b2b2b" strokeWidth="2" />
        <circle cx="102.5" cy="29.5" r="1.6" fill="#6aa0ff" opacity="0.6" />
        {[60, 66, 72, 138, 144, 150].map((x) => (
          <circle key={x} cx={x} cy="31" r="1.1" fill="#333" />
        ))}
        <circle cx="84" cy="31" r="2.2" fill={dim ? "#333" : "#3DDC84"} />
        <circle cx="91" cy="31" r="2.2" fill={led} />
        {(state === "deposited" || state === "error") && (
          <circle cx="91" cy="31" r="2.2" fill="none" stroke={led} strokeWidth="1.5">
            <animate attributeName="r" from="2" to="9" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}

        {/* compartment opening (visible when door swings) */}
        <rect x="38" y="60" width="132" height="168" rx="16" fill={`url(#inside-${id})`} />
        {hasParcel && (
          <g>
            <ellipse cx="104" cy="196" rx="70" ry="40" fill={`url(#glow-${id})`} opacity={open ? 1 : 0} />
            <g transform="translate(64 142)">
              <path d="M0 18 L40 0 L80 18 L80 66 L40 84 L0 66 Z" fill="#C99A61" />
              <path d="M0 18 L40 36 L80 18 L40 0 Z" fill="#E0B57A" />
              <path d="M40 36 L40 84 L80 66 L80 18 Z" fill="#AD7F4A" />
              <path d="M18 9 L58 27 L58 40 L18 22 Z" fill="#E9D3A7" opacity="0.9" />
              <rect x="48" y="50" width="22" height="13" rx="1.5" transform="skewY(-24)" fill="#F7F3EA" opacity="0.9" />
            </g>
          </g>
        )}

        {/* door */}
        <motion.g
          initial={false}
          animate={open ? { scaleX: 0.16, skewY: -10, x: -4 } : { scaleX: 1, skewY: 0, x: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 18 }}
          style={{ originX: 0, originY: 0.5 }}
        >
          <rect x="38" y="60" width="132" height="168" rx="16" fill={`url(#door-${id})`} />
          <rect x="38" y="60" width="132" height="168" rx="16" fill="none" stroke="#000" strokeOpacity="0.3" />
          <path d="M50 70 L120 70 L58 214 L50 214 Z" fill="#fff" opacity="0.04" />
          <rect x="157" y="118" width="6" height="50" rx="3" fill="#2e2e2e" stroke="#555" strokeWidth="0.8" />
        </motion.g>

        {/* lower panel */}
        <rect x="38" y="240" width="132" height="104" rx="14" fill="#E9E5DE" stroke="#fff" strokeOpacity="0.6" />
        <rect x="157" y="276" width="5" height="40" rx="2.5" fill="#BFBAB1" />
        <rect x="160" y="246" width="12" height="22" rx="6" fill="#DAD5CC" stroke="#C9C3B8" />
        {hasParcel && !open && <rect x="52" y="234" width="104" height="3" rx="1.5" fill="#F15A00" opacity="0.85" />}
      </g>

      {state === "error" && (
        <g transform="translate(88 120)">
          <circle cx="16" cy="16" r="18" fill="#FF4A2E" />
          <path d="M16 7 v11 M16 23 v2" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
