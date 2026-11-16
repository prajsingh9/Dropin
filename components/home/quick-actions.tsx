import { Cpu, History, Moon, Package, Video } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { href: "/visitors/live/monitor", label: "Camera", icon: Video, accent: true },
  { href: "/parcels", label: "Parcels", icon: Package },
  { href: "/visitors", label: "Visitors", icon: History },
  { href: "/device", label: "Device", icon: Cpu },
  { href: "/device/quiet-hours", label: "Quiet hours", icon: Moon },
];

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-5 gap-2">
      {ACTIONS.map(({ href, label, icon: Icon, accent }) => (
        <Link key={href} href={href} className="group flex min-w-0 flex-col items-center gap-2">
          <span className={`flex size-[58px] sm:size-[68px] items-center justify-center rounded-full shadow-card transition group-active:scale-95 ${accent ? "bg-accent text-on-accent" : "bg-surface text-fg group-hover:bg-surface-2"}`}>
            <Icon className="size-6" strokeWidth={1.8} />
          </span>
          <span className="w-full truncate text-center text-[12px] font-semibold sm:text-[13px]">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
