"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Sheet } from "./sheet";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  icon?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} hideClose>
      <div className="pt-2 text-center">
        {icon && <div className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-full ${destructive ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"}`}>{icon}</div>}
        <h2 className="text-heading font-semibold">{title}</h2>
        <div className="mx-auto mt-2 max-w-sm text-sm text-muted">{description}</div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "ink"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch {
                /* caller surfaces the error */
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
