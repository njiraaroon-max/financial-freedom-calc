import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * What we ship:
 *   - X-Frame-Options: DENY
 *       Block embedding the app in an iframe (anti-clickjacking).
 *       No legitimate need to be embedded — FA uses the app directly.
 *   - X-Content-Type-Options: nosniff
 *       Stop browsers from MIME-sniffing responses; serve files only
 *       as the declared content-type. Defends against polyglot
 *       attacks (a file disguised as image but parsed as JS).
 *   - Referrer-Policy: strict-origin-when-cross-origin
 *       Send full referrer same-origin, only origin cross-origin,
 *       and nothing on HTTP-from-HTTPS. Prevents leaking client
 *       tokens/IDs through query strings to third parties.
 *   - Permissions-Policy
 *       Explicitly disable browser APIs we don't use (camera, mic,
 *       geolocation, payment, USB, ...). Reduces surface for any
 *       embedded third-party script to abuse them.
 *   - X-DNS-Prefetch-Control: on
 *       Allow DNS prefetch — minor perf win for cross-origin assets.
 *
 * What we deliberately DON'T ship yet:
 *   - Content-Security-Policy
 *       CSP is the single highest-impact header but extremely easy
 *       to misconfigure (Next.js inline styles, hydration scripts,
 *       Supabase realtime websocket, Recharts inline SVG). Rolling
 *       it out before the May 16-17 launch is too risky. Plan: add
 *       in Phase 2 with a Report-Only test cycle first.
 *
 * HSTS is already set automatically by Vercel:
 *   strict-transport-security: max-age=63072000
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()", // opt out of FLoC tracking
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
