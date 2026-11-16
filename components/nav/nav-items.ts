import { Activity, House, Package, ScanFace, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: House },
  { href: "/parcels", label: "Parcels", icon: Package },
  { href: "/visitors", label: "Visitors", icon: ScanFace },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/settings") return pathname.startsWith("/settings") || pathname.startsWith("/device");
  return pathname === href || pathname.startsWith(`${href}/`);
}
