import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card", className)}>{children}</div>;
}

export function ListRow({ icon: Icon, title, detail, href, onClick, children, tone, iconClassName }: { icon?: LucideIcon; title: ReactNode; detail?: ReactNode; href?: string; onClick?: () => void; children?: ReactNode; tone?: "danger"; iconClassName?: string }) {
  const inner = (
    <>
      {Icon && (
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2", iconClassName)}>
          <Icon className="size-5" strokeWidth={1.9} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-semibold", tone === "danger" && "text-danger")}>{title}</span>
        {detail && <span className="block truncate text-[13px] text-muted">{detail}</span>}
      </span>
      {children ?? (href || onClick ? <ChevronRight className="size-5 shrink-0 text-muted" /> : null)}
    </>
  );
  const cls = "flex w-full items-center gap-4 px-5 py-4 text-left";
  if (href) return <Link href={href} className={cn(cls, "transition-colors hover:bg-surface-2/50")}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, "transition-colors hover:bg-surface-2/50")}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
