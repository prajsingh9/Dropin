"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn, uid } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "event";
interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
  image?: ReactNode;
}

const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = uid();
      setToasts((prev) => [{ ...t, id }, ...prev].slice(0, 3));
      setTimeout(() => dismiss(id), t.tone === "error" ? 6500 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4 pt-3 sm:items-end sm:pr-6 sm:pt-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const body = (
              <>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full",
                    t.tone === "success" && "bg-success-soft text-success",
                    t.tone === "error" && "bg-danger-soft text-danger",
                    t.tone === "info" && "bg-surface-2 text-fg",
                    t.tone === "event" && "bg-accent text-on-accent",
                  )}
                >
                  {t.image ?? t.icon ?? (t.tone === "success" ? <CircleCheck className="size-5" /> : t.tone === "error" ? <CircleAlert className="size-5" /> : <Info className="size-5" />)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{t.title}</p>
                  {t.description && <p className="line-clamp-2 text-[13px] text-on-ink-muted">{t.description}</p>}
                </div>
              </>
            );
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[22px] bg-ink p-2.5 pr-3 text-on-ink shadow-float ring-1 ring-white/5"
                role={t.tone === "error" ? "alert" : "status"}
              >
                {t.href ? (
                  <Link href={t.href} onClick={() => dismiss(t.id)} className="flex min-w-0 flex-1 items-center gap-3">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
                )}
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex size-8 items-center justify-center rounded-full text-on-ink-muted hover:bg-white/10">
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
