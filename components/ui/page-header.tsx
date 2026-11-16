"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

export function PageHeader({ title, eyebrow, back, actions, className, children }: { title: ReactNode; eyebrow?: ReactNode; back?: string | true; actions?: ReactNode; className?: string; children?: ReactNode }) {
  const router = useRouter();
  return (
    <header className={cn("pb-5 pt-2", className)}>
      {(back || actions) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {back ? (
            <IconButton label="Back" variant="outline" onClick={() => (back === true ? router.back() : router.push(back))}>
              <ChevronLeft className="size-5" strokeWidth={2} />
            </IconButton>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      {eyebrow && <div className="mb-2 text-sm font-semibold text-muted">{eyebrow}</div>}
      <h1 className="text-title font-semibold">{title}</h1>
      {children}
    </header>
  );
}
