"use client";

import { cn } from "@/lib/utils";

export function Slider({ value, onChange, onCommit, min = 0, max = 100, step = 1, label, disabled, className }: { value: number; onChange: (v: number) => void; onCommit?: (v: number) => void; min?: number; max?: number; step?: number; label: string; disabled?: boolean; className?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      className={cn(
        "h-12 w-full cursor-pointer appearance-none rounded-full bg-transparent disabled:opacity-40",
        "[&::-webkit-slider-runnable-track]:h-12 [&::-webkit-slider-runnable-track]:rounded-full",
        "[&::-webkit-slider-thumb]:mt-1 [&::-webkit-slider-thumb]:size-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.25)]",
        "[&::-moz-range-thumb]:size-10 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-12 [&::-moz-range-track]:rounded-full",
        className,
      )}
      style={{ background: `linear-gradient(90deg, var(--accent) 0%, var(--accent) calc(${pct}% * 0.9 + 24px), var(--surface-2) calc(${pct}% * 0.9 + 24px))` }}
    />
  );
}
