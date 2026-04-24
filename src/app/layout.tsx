import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ToastContainer from "@/components/ToastContainer";
import ConfirmDialog from "@/components/ConfirmDialog";

// Legacy-skin display font — characterful Thai display face paired with
// system body. Exposed via `--font-display` and used by the original
// "Financial Friend" consumer surfaces.
const displayFont = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Professional-skin display font — Prompt is the wealth-management /
// private-banking face. More geometric, more letter-spaced, reads as
// "premium Thai corporate". Exposed via `--font-prompt` and referenced
// by HomePro + professional PageHeader so the pro skin gets the right
// typographic voice even before an org-specific font is loaded.
const promptFont = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Financial Friend Calculator",
  description: "เครื่องมือวางแผนการเงินส่วนบุคคลแบบองค์รวม",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FFC Planner",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${displayFont.variable} ${promptFont.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#6366f1" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <ToastContainer />
        <ConfirmDialog />
      </body>
    </html>
  );
}
