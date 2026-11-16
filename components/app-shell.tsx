"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { DropinLogo } from "@/components/brand/logo";
import { SimulatorPanel } from "@/components/dev/simulator-panel";
import { BottomNav } from "@/components/nav/bottom-nav";
import { SideRail } from "@/components/nav/side-rail";
import { useDropin } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IncomingVisitor } from "@/components/visitors/incoming-visitor";

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useDropin();
  const router = useRouter();
  const pathname = usePathname();
  const immersive = pathname.startsWith("/visitors/live");

  useEffect(() => {
    if (status === "signed_out") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (status === "needs_onboarding") router.replace("/onboarding");
  }, [status, router, pathname]);

  if (status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <DropinLogo />
        <h1 className="mt-6 text-heading font-semibold">We couldn&apos;t reach your home</h1>
        <p className="max-w-sm text-sm text-muted">{error}</p>
        <Button icon={<RefreshCw className="size-4" />} onClick={() => refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 pt-8 sm:px-6 lg:pl-[132px]" aria-busy="true" aria-label="Loading">
        <Skeleton className="mb-8 h-6 w-28" />
        <Skeleton className="mb-3 h-12 w-3/4" />
        <Skeleton className="mb-8 h-12 w-1/2" />
        <Skeleton className="h-[340px] w-full rounded-card" />
      </div>
    );
  }

  return (
    <>
      {!immersive && <SideRail />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          className={immersive ? "" : "pt-safe mx-auto w-full max-w-[1120px] px-4 pb-36 pt-4 sm:px-6 lg:pb-16 lg:pl-[140px] lg:pr-10 lg:pt-8"}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      {!immersive && <BottomNav />}
      {!immersive && <SimulatorPanel />}
      <IncomingVisitor />
    </>
  );
}
