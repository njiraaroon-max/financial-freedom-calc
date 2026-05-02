/**
 * /quick-plan — server-component layout that supplies route-specific
 * metadata (page.tsx is "use client" and can't export metadata itself).
 *
 * The opengraph-image.tsx sibling auto-generates the share preview;
 * this file just gives /quick-plan its own title + Thai description so
 * LINE/Facebook show lead-gen-friendly copy when the URL is shared.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quick Plan · ประเมินสถานะการเงินใน 60 วินาที",
  description:
    "ตอบ 4 คำถามสั้นๆ — รับ Pyramid Score 0-100 + คำแนะนำเฉพาะคุณ ฟรี ไม่ต้อง login",
  openGraph: {
    title: "Quick Plan · ประเมินสถานะการเงินใน 60 วินาที",
    description:
      "ตอบ 4 คำถามสั้นๆ — รับ Pyramid Score 0-100 + คำแนะนำเฉพาะคุณ ฟรี ไม่ต้อง login",
    url: "https://wealthplanner.finance/quick-plan",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quick Plan · 60 วินาที",
    description: "ประเมินสถานะการเงินของคุณใน 60 วินาที",
  },
};

export default function QuickPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
