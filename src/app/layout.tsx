import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastContainer from "@/components/ToastContainer";
import ConfirmDialog from "@/components/ConfirmDialog";

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
    <html lang="th">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#6366f1" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
        {children}
        <ToastContainer />
        <ConfirmDialog />
      </body>
    </html>
  );
}
