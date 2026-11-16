"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="bottom-safe fixed inset-x-0 z-40 flex justify-center px-4 lg:hidden">
      <div className="flex h-[68px] w-full max-w-[440px] items-center gap-1 rounded-full bg-ink p-2 shadow-float ring-1 ring-white/5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex h-full items-center justify-center rounded-full transition-[flex-grow] duration-300", active ? "flex-[2.2]" : "flex-1")}
            >
              {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
              <span className={cn("relative flex items-center gap-2 text-[13px] font-semibold", active ? "text-on-accent" : "text-on-ink-muted")}>
                <Icon className="size-[22px]" strokeWidth={1.9} aria-hidden />
                {active ? <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}>{label}</motion.span> : <span className="sr-only">{label}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
