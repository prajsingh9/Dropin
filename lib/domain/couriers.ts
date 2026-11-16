/** Courier display styles. We render monograms, not trademarked logos. */
export interface CourierStyle {
  name: string;
  short: string;
  bg: string;
  fg: string;
}

const STYLES: CourierStyle[] = [
  { name: "DHL", short: "DHL", bg: "#E5B928", fg: "#B4120C" },
  { name: "FedEx", short: "Fx", bg: "#3B1C6B", fg: "#FFFFFF" },
  { name: "Blue Dart", short: "BD", bg: "#103A8C", fg: "#FFFFFF" },
  { name: "Delhivery", short: "Dv", bg: "#1A1A1A", fg: "#F15A00" },
  { name: "Amazon", short: "Am", bg: "#222A33", fg: "#F7B23B" },
  { name: "UPS", short: "UPS", bg: "#3F2A1C", fg: "#F5B700" },
  { name: "India Post", short: "IP", bg: "#B5121B", fg: "#FFFFFF" },
  { name: "Ekart", short: "Ek", bg: "#F3EBD0", fg: "#2F55D4" },
];

export const KNOWN_COURIERS = STYLES.map((s) => s.name);

export function courierStyle(name: string | null | undefined): CourierStyle {
  if (!name) return { name: "Unidentified", short: "?", bg: "#D9D4CA", fg: "#111111" };
  const found = STYLES.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  const short = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return { name, short, bg: "#111111", fg: "#F4F1EB" };
}
