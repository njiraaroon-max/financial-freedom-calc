import { ImageResponse } from "next/og";

export const alt = "Wealth Planner — Financial Planning Suite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0f1e33 0%, #1e3a5f 60%, #0f1e33 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "80px 96px",
          position: "relative",
        }}
      >
        {/* Aurora glow top-right */}
        <div
          style={{
            position: "absolute",
            top: "-12%",
            right: "-8%",
            width: "55%",
            height: "85%",
            background:
              "radial-gradient(circle, rgba(214,181,109,0.32) 0%, rgba(214,181,109,0.08) 50%, transparent 75%)",
            filter: "blur(50px)",
            display: "flex",
          }}
        />

        {/* Pyramid SVG accent — lower-right corner */}
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            right: "96px",
            display: "flex",
            opacity: 0.85,
          }}
        >
          <svg width="180" height="160" viewBox="0 0 180 160" fill="none">
            <defs>
              <linearGradient id="goldT" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d6b56d" />
                <stop offset="100%" stopColor="#b89150" />
              </linearGradient>
              <linearGradient id="navyT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a5a85" />
                <stop offset="100%" stopColor="#1e3a5f" />
              </linearGradient>
            </defs>
            {/* 4 tier pyramid */}
            <polygon points="90,10 113,50 67,50" fill="url(#goldT)" />
            <polygon points="113,52 136,92 44,92 67,52" fill="url(#navyT)" />
            <polygon points="136,94 159,134 21,134 44,94" fill="url(#navyT)" opacity="0.85" />
            <polygon points="159,136 180,160 0,160 21,136" fill="url(#navyT)" opacity="0.7" />
          </svg>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: 24,
            color: "#d6b56d",
            letterSpacing: 8,
            fontWeight: 700,
            marginBottom: 28,
            display: "flex",
          }}
        >
          WEALTH PLANNER
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            display: "flex",
            flexDirection: "column",
            marginBottom: 36,
          }}
        >
          <div style={{ display: "flex" }}>Plan Wealth.</div>
          <div style={{ display: "flex", color: "#d6b56d" }}>Build Legacy.</div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 30,
            opacity: 0.82,
            display: "flex",
            maxWidth: 760,
            lineHeight: 1.3,
          }}
        >
          Financial Planning Suite for Advisors
        </div>

        {/* URL footer */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 96,
            fontSize: 22,
            color: "#d6b56d",
            fontWeight: 600,
            letterSpacing: 1,
            display: "flex",
          }}
        >
          wealthplanner.finance
        </div>
      </div>
    ),
    { ...size }
  );
}
