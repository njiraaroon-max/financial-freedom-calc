"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  UserCircle2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSkin } from "@/store/fa-session-store";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  characterImg?: string;
  /** Optional override — if provided, used for the pro skin instead of the map lookup. */
  iconPro?: LucideIcon;
  icon?: React.ReactNode;
  backHref?: string;
  rightElement?: React.ReactNode;
}

/**
 * Map legacy cartoon PNG paths → the Lucide icon we want to render when the
 * tenant is on the professional skin. Keeping the lookup in one place means
 * calculator pages don't have to change — they keep passing `characterImg`
 * exactly as before, and the skin switch happens here.
 */
const CHARACTER_TO_LUCIDE: Record<string, LucideIcon> = {
  "/character/summary.png": LayoutDashboard,
  "/character/balance.png": Scale,
  "/character/cashflow.png": Wallet,
  "/character/emergency.png": LifeBuoy,
  "/character/journey.png": Target,
  "/character/retirement.png": Sparkles,
  "/character/tax.png": Receipt,
  "/character/profile.png": UserCircle2,
  "/circle-icons/profile.png": UserCircle2,
  "/circle-icons/risk-management.png": ShieldCheck,
};

export default function PageHeader({
  title,
  subtitle,
  characterImg,
  iconPro,
  icon,
  backHref = "/",
  rightElement,
}: PageHeaderProps) {
  const skin = useSkin();
  const isPro = skin === "professional";

  // Resolve which icon (if any) to render in pro mode. Explicit `iconPro` wins,
  // otherwise look up the cartoon path, otherwise fall back to a generic
  // calculator glyph so the header still looks intentional.
  const ProIcon: LucideIcon | null = isPro
    ? iconPro ??
      (characterImg ? CHARACTER_TO_LUCIDE[characterImg] ?? Calculator : null)
    : null;

  const showPngCharacter = !isPro && !!characterImg;

  return (
    <div className="sticky top-0 z-20 glass-strong border-b border-white/50">
      <div
        className={`flex items-center ${rightElement ? "justify-between" : "gap-3"} px-4 md:px-8 py-3`}
      >
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition"
          >
            <ArrowLeft size={20} />
          </Link>

          {/* Legacy: cartoon PNG */}
          {showPngCharacter && (
            <img
              src={characterImg}
              alt={title}
              className="w-16 h-16 object-contain"
            />
          )}

          {/* Professional: navy-tinted Lucide tile (replaces cartoon) */}
          {isPro && ProIcon && (
            <div
              className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
              style={{
                background: "color-mix(in srgb, var(--color-primary) 10%, white)",
                border: "1px solid color-mix(in srgb, var(--color-primary) 22%, white)",
              }}
            >
              <ProIcon
                size={24}
                strokeWidth={1.75}
                style={{ color: "var(--color-primary)" }}
              />
            </div>
          )}

          {/* Generic icon prop (used by pages that opted out of characterImg, eg. cf-projection) */}
          {icon && !characterImg && icon}

          <div>
            <h1
              className={
                isPro
                  ? "font-display text-lg md:text-xl font-bold tracking-tight"
                  : "font-display text-lg md:text-xl font-bold tracking-tight bg-gradient-to-br from-indigo-700 via-violet-600 to-cyan-600 bg-clip-text text-transparent"
              }
              style={isPro ? { color: "var(--color-primary-dark)" } : undefined}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-[13px] md:text-[14px] text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {rightElement && <div className="shrink-0">{rightElement}</div>}
      </div>
    </div>
  );
}
