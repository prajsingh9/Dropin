import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Dropin",
    short_name: "Dropin",
    description: "Parcels, visitors and your Dropin collector — in one calm place.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F1EB",
    theme_color: "#111111",
    categories: ["lifestyle", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Parcels", url: "/parcels", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Visitors", url: "/visitors", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
