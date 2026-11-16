"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on mobile, centred dialog on larger screens.
 * Traps Escape, locks body scroll and restores focus.
 */
export function Sheet({ open, onClose, title, description, children, className, hideClose, tone = "surface" }: { open: boolean; onClose: () => void; title?: string; description?: string; children: ReactNode; className?: string; hideClose?: boolean; tone?: "surface" | "ink" }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className={cn(
              "pb-safe relative max-h-[92dvh] w-full overflow-y-auto rounded-t-sheet px-5 pt-3 outline-none sm:max-w-lg sm:rounded-sheet sm:pb-6",
              tone === "ink" ? "bg-ink text-on-ink" : "bg-surface text-fg",
              className,
            )}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-current opacity-15 sm:hidden" aria-hidden />
            {(title || !hideClose) && (
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  {title && (
                    <h2 id={titleId} className="text-heading font-semibold">
                      {title}
                    </h2>
                  )}
                  {description && <p className={cn("mt-1 text-sm", tone === "ink" ? "text-on-ink-muted" : "text-muted")}>{description}</p>}
                </div>
                {!hideClose && (
                  <button onClick={onClose} aria-label="Close" className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tone === "ink" ? "bg-white/10" : "bg-surface-2")}>
                    <X className="size-[18px]" strokeWidth={2} />
                  </button>
                )}
              </div>
            )}
            <div className="pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
