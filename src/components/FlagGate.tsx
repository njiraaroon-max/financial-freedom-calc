"use client";

/**
 * FlagGate — render children only when a feature flag is enabled,
 * otherwise show a friendly access-denied surface. Used to wrap entire
 * route components so direct-URL access is blocked the same as
 * via-tile access — auditable from the browser address bar (URL still
 * resolves, content is just a "ฟีเจอร์นี้ปิดอยู่" message).
 *
 * Pattern:
 *   export default function MyPage() {
 *     return (
 *       <FlagGate flag="ci_shock_simulator" fallbackEnabled={true}>
 *         <ActualPage />
 *       </FlagGate>
 *     );
 *   }
 *
 * `fallbackEnabled` matches the FEATURE_GROUPS `defaultTrue` policy:
 *   • Existing features (CI Shock, PDF, etc.) → fallback=true so missing
 *     flag values resolve to ON. Admin must explicitly turn off.
 *   • New / opt-in features (Health+Savings Combo) → fallback=false so
 *     only orgs/admins who opt-in see the surface.
 */

import Link from "next/link";
import { Lock, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useFeatureFlag } from "@/store/fa-session-store";
import type { FeatureFlags } from "@/lib/supabase/database.types";

export interface FlagGateProps {
  flag: keyof FeatureFlags;
  /** Default behavior when no explicit value exists in the FA's profile. */
  fallbackEnabled?: boolean;
  /** Override the title shown on the access-denied surface. */
  deniedTitle?: string;
  /** Override the body copy on the access-denied surface. */
  deniedBody?: string;
  /** Where the "Back" link points when the user can't access. */
  backHref?: string;
  /** Label for the back link. */
  backLabel?: string;
  children: React.ReactNode;
}

export default function FlagGate({
  flag,
  fallbackEnabled = false,
  deniedTitle = "ฟีเจอร์นี้ถูกปิดใช้งาน",
  deniedBody = "ผู้ดูแลระบบของคุณได้ปิดการเข้าถึงฟีเจอร์นี้ ถ้าคุณคิดว่าควรได้รับสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ",
  backHref = "/",
  backLabel = "กลับหน้าหลัก",
  children,
}: FlagGateProps) {
  const enabled = useFeatureFlag(flag, fallbackEnabled);
  if (enabled) return <>{children}</>;
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader title="Feature unavailable" subtitle="" backHref={backHref} />
      <div className="px-4 md:px-8 pt-10 max-w-md mx-auto">
        <div className="glass rounded-2xl p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock size={26} className="text-amber-600" />
          </div>
          <div className="text-base font-bold text-gray-800 mb-2">
            {deniedTitle}
          </div>
          <div className="text-[13px] text-gray-500 leading-relaxed">
            {deniedBody}
          </div>
          <Link
            href={backHref}
            className="mt-4 inline-flex items-center gap-1 text-[13px] text-indigo-600 font-bold hover:underline"
          >
            <ChevronRight size={14} className="rotate-180" />
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
