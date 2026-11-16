"use client";

import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropinMark } from "@/components/brand/logo";
import { useHousehold } from "@/components/providers/dropin-provider";
import { cn, initials } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Desktop navigation: a floating ink rail rather than an admin sidebar. */
export function SideRail() {
  const pathname = usePathname();
  const { unreadCount, snapshot } = useHousehold();
  return (
    <nav aria-label="Primary" className="fixed inset-y-5 left-5 z-40 hidden w-[84px] flex-col items-center rounded-[34px] bg-ink py-5 text-on-ink shadow-float lg:flex">
      <Link href="/home" aria-label="Dropin home" className="mb-8 text-on-ink">
        <DropinMark className="size-9 [--bg:#111]" />
      </Link>
      <div className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className="group relative flex size-14 items-center justify-center rounded-full">
              {active && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
              <Icon className={cn("relative size-[22px]", active ? "text-on-accent" : "text-on-ink-muted group-hover:text-on-ink")} strokeWidth={1.9} />
              <span className="pointer-events-none absolute left-[calc(100%+12px)] whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-semibold opacity-0 shadow-float transition group-hover:opacity-100">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-3">
        <Link href="/notifications" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative flex size-12 items-center justify-center rounded-full text-on-ink-muted hover:bg-white/10 hover:text-on-ink">
          <Bell className="size-[22px]" strokeWidth={1.9} />
          {unreadCount > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-accent ring-2 ring-ink" />}
        </Link>
        <Link href="/settings/account" aria-label="Account" className="flex size-11 items-center justify-center rounded-full bg-paper text-sm font-bold text-on-paper">
          {initials(snapshot.user.full_name)}
        </Link>
      </div>
    </nav>
  );
}
