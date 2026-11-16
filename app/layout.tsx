import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { DropinProvider } from "@/components/providers/dropin-provider";
import { ThemeProvider, themeScript } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Dropin", template: "%s · Dropin" },
  description: "Parcels, visitors and your Dropin collector — in one calm place.",
  applicationName: "Dropin",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Dropin", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4F1EB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <ToastProvider>
            <DropinProvider>{children}</DropinProvider>
          </ToastProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
