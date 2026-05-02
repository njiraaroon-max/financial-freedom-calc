import { ImageResponse } from "next/og";

export const alt = "Quick Plan — Score Your Financial Pyramid in 60 Seconds";
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
        {/* Aurora glow */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            right: "-10%",
            width: "60%",
            height: "100%",
            background:
              "radial-gradient(circle, rgba(214,181,109,0.38) 0%, rgba(214,181,109,0.10) 45%, transparent 70%)",
            filter: "blur(60px)",
            display: "flex",
          }}
        />

        {/* Score gauge accent — lower right */}
        <div
          style={{
            position: "absolute",
            bottom: "70px",
            right: "100px",
            width: 200,
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.95,
          }}
        >
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="goldArc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d6b56d" />
                <stop offset="100%" stopColor="#b89150" />
              </linearGradient>
            </defs>
            {/* Background ring */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="14"
            />
            {/* Score arc — ~75% */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="url(#goldArc)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="376 502"
              transform="rotate(-90 100 100)"
            />
          </svg>
          {/* Center number — div overlay, since Satori doesn't support <text> */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#d6b56d",
              display: "flex",
              position: "relative",
              zIndex: 1,
            }}
          >
            75
          </div>
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
          QUICK PLAN · 60 SECONDS
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            display: "flex",
            flexDirection: "column",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex" }}>Score Your</div>
          <div style={{ display: "flex", color: "#d6b56d" }}>
            Financial Pyramid
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            opacity: 0.82,
            display: "flex",
            maxWidth: 720,
            lineHeight: 1.3,
          }}
        >
          Free assessment · No signup · Instant results
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
          wealthplanner.finance/quick-plan
        </div>
      </div>
    ),
    { ...size }
  );
}
