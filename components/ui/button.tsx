"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "ink" | "accent" | "surface" | "ghost" | "outline" | "danger" | "paper";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  ink: "bg-ink text-on-ink hover:bg-ink-2 dark:bg-on-ink dark:text-[#111] dark:hover:bg-white",
  accent: "bg-accent text-on-accent hover:brightness-105",
  surface: "bg-surface text-fg shadow-card hover:bg-surface-2",
  paper: "bg-paper text-on-paper hover:brightness-[0.98]",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  outline: "bg-transparent text-fg ring-1 ring-inset ring-line hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-105",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-12 px-5 text-[15px] gap-2",
  lg: "h-14 px-6 text-base gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ink", size = "md", loading, icon, block, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold tracking-[-0.01em] transition-[transform,background-color,filter,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="size-[18px] animate-spin" strokeWidth={2} aria-hidden /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "surface" | "ink" | "accent" | "ghost" | "glass" | "outline";
  size?: "sm" | "md" | "lg";
  badge?: number | boolean;
}

const ICON_VARIANTS = {
  surface: "bg-surface text-fg shadow-card hover:bg-surface-2",
  ink: "bg-ink text-on-ink hover:bg-ink-2",
  accent: "bg-accent text-on-accent",
  ghost: "text-fg hover:bg-surface-2",
  glass: "bg-white/12 text-white ring-1 ring-inset ring-white/15 backdrop-blur-md hover:bg-white/20",
  outline: "text-fg ring-1 ring-inset ring-line hover:bg-surface-2",
};
const ICON_SIZES = { sm: "size-9", md: "size-11", lg: "size-14" };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "surface", size = "md", badge, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-150 active:scale-95 disabled:opacity-40",
        ICON_VARIANTS[variant],
        ICON_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[18px] text-on-accent ring-2 ring-bg">
          {typeof badge === "number" ? (badge > 9 ? "9+" : badge) : ""}
        </span>
      ) : null}
    </button>
  );
});

/** Circular icon link (an <a>, not a nested button). */
export function IconLink({ href, label, badge, variant = "surface", className, children }: { href: string; label: string; badge?: number; variant?: keyof typeof ICON_VARIANTS; className?: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className={cn("relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-95", ICON_VARIANTS[variant], className)}>
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[18px] text-on-accent ring-2 ring-bg">{badge > 9 ? "9+" : badge}</span>
      ) : null}
    </Link>
  );
}
