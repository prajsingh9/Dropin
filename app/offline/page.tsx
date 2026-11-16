import { WifiOff } from "lucide-react";
import { DropinLogo } from "@/components/brand/logo";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="pt-safe flex min-h-dvh flex-col justify-between px-6 py-10">
      <DropinLogo />
      <div>
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-ink text-on-ink">
          <WifiOff className="size-7" strokeWidth={1.8} />
        </div>
        <h1 className="text-display font-semibold">You&apos;re offline</h1>
        <p className="mt-4 max-w-sm text-lg text-muted">Your Dropin keeps working on its own — parcels stay locked and visitors are recorded. Reconnect to see what happened.</p>
      </div>
      <a href="/home" className="flex h-14 items-center justify-center rounded-full bg-ink text-base font-semibold text-on-ink dark:bg-on-ink dark:text-[#111]">
        Try again
      </a>
    </main>
  );
}
