"use client";

// ─── /calculators/insurance/compare ────────────────────────────────────────
// Thin wrapper around <CompareWorkspace>.  All bundle state, charts, tables,
// and the NHS coverage tab live in the reusable workspace component — this
// file just provides the page chrome (header, page padding) and turns on
// URL sync for shareable links.
//
// The same workspace is embedded on /calculators/insurance/policies as the
// "เปรียบเทียบแผน" tab, without urlSync.

import { Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import CompareWorkspace from "@/components/allianz/compare/CompareWorkspace";

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="เปรียบเทียบแผน"
        subtitle="Compare Bundles"
        backHref="/calculators/insurance"
        icon={<Users size={28} className="text-indigo-600" />}
      />

      <div className="px-3 md:px-6 pt-4 pb-10 max-w-7xl mx-auto">
        <CompareWorkspace urlSync />
      </div>
    </div>
  );
}
