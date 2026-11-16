import { Camera, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParcelSnapshot } from "./parcel-snapshot";
import { VisitorFrame } from "./visitor-frame";

/**
 * Renders a camera image reference.
 *  - `sim://parcel/<seed>` / `sim://visitor/<seed>` → generated simulation image
 *  - `https://…` → a short-lived signed URL from private storage
 *  - null → neutral placeholder
 */
export function MediaImage({ src, kind, alt, className, night, label }: { src: string | null | undefined; kind: "parcel" | "visitor"; alt: string; className?: string; night?: boolean; label?: boolean }) {
  if (src?.startsWith("sim://")) {
    const seed = src.split("/").pop() ?? "0";
    return src.startsWith("sim://parcel") ? <ParcelSnapshot seed={seed} className={className} label={label} /> : <VisitorFrame seed={seed} className={className} night={night} label={label} />;
  }
  if (src && /^https:\/\//.test(src)) {
    // eslint-disable-next-line @next/next/no-img-element -- signed, private, short-lived URLs must not go through the image optimizer cache
    return <img src={src} alt={alt} referrerPolicy="no-referrer" className={cn("h-full w-full object-cover", className)} />;
  }
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-surface-2 text-muted", className)} role="img" aria-label={`${alt} — no image captured`}>
      {kind === "parcel" ? <Package className="size-8" strokeWidth={1.5} /> : <Camera className="size-8" strokeWidth={1.5} />}
    </div>
  );
}
