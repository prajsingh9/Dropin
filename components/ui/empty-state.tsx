import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: { icon: ReactNode; title: string; description: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-card bg-surface-2/60 px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-surface text-muted shadow-card">{icon}</div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
