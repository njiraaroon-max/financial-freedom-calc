"use client";

interface GaugeZone {
  start: number;
  end: number;
  color: string;
}

interface ColorStop {
  position: number; // 0-100
  color: string;    // hex
}

interface GaugeChartProps {
  value: number;
  displayValue: string;
  benchmarkPosition?: number;
  benchmarkLabel?: string;
  zones: GaugeZone[];
  leftLabel?: string;
  rightLabel?: string;
  hasData: boolean;
}

// Parse hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const h = parseInt(hex.replace("#", ""), 16);
  return [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff];
}

// RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Smooth interpolation between multiple color stops
function getColorAtPosition(stops: ColorStop[], position: number): string {
  if (stops.length === 0) return "#e5e7eb";
  if (position <= stops[0].position) return stops[0].color;
  if (position >= stops[stops.length - 1].position) return stops[stops.length - 1].color;

  // Find the two stops we're between
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (position >= stops[i].position && position <= stops[i + 1].position) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const t = (position - lower.position) / (upper.position - lower.position);
  const [r1, g1, b1] = hexToRgb(lower.color);
  const [r2, g2, b2] = hexToRgb(upper.color);
  return rgbToHex(
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  );
}

// Convert zones to color stops (zone midpoints define colors, smooth blend between)
function zonesToColorStops(zones: GaugeZone[]): ColorStop[] {
  const stops: ColorStop[] = [];
  for (const zone of zones) {
    const mid = (zone.start + zone.end) / 2;
    stops.push({ position: mid, color: zone.color });
  }
  // Add edge stops to ensure full coverage
  if (stops.length > 0) {
    stops.unshift({ position: 0, color: zones[0].color });
    stops.push({ position: 100, color: zones[zones.length - 1].color });
  }
  return stops;
}

export default function GaugeChart({
  value,
  displayValue,
  benchmarkPosition,
  benchmarkLabel,
  zones,
  leftLabel = "0%",
  rightLabel = "100%",
  hasData,
}: GaugeChartProps) {
  const cx = 120;
  const cy = 100;
  const radius = 70;
  const strokeWidth = 14;
  const svgWidth = 240;
  const svgHeight = 135;
  const segments = 120; // high count for silky smooth gradient

  const valueAngle = 180 - (Math.min(Math.max(value, 0), 100) / 100) * 180;
  const needleLength = radius - 10;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (startPct: number, endPct: number) => {
    const startAngle = 180 - (startPct / 100) * 180;
    const endAngle = 180 - (endPct / 100) * 180;
    const x1 = cx + radius * Math.cos(toRad(startAngle));
    const y1 = cy - radius * Math.sin(toRad(startAngle));
    const x2 = cx + radius * Math.cos(toRad(endAngle));
    const y2 = cy - radius * Math.sin(toRad(endAngle));
    const largeArc = Math.abs(endPct - startPct) > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const needleX = cx + needleLength * Math.cos(toRad(valueAngle));
  const needleY = cy - needleLength * Math.sin(toRad(valueAngle));

  const bmAngle = benchmarkPosition !== undefined ? 180 - (benchmarkPosition / 100) * 180 : 0;
  const bmOuterRadius = radius + strokeWidth / 2 + 6;
  const bmX = cx + bmOuterRadius * Math.cos(toRad(bmAngle));
  const bmY = cy - bmOuterRadius * Math.sin(toRad(bmAngle));
  const bmLabelRadius = radius + strokeWidth / 2 + 22;
  const bmLabelX = cx + bmLabelRadius * Math.cos(toRad(bmAngle));
  const bmLabelY = cy - bmLabelRadius * Math.sin(toRad(bmAngle));

  // Generate color stops from zones
  const colorStops = zonesToColorStops(zones);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center">
        <svg width="140" height="90" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <path d={arcPath(0, 100)} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} strokeLinecap="round" />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="#9ca3af" fontSize="12" fontWeight="600">
            ไม่มีข้อมูล
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="100" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {/* Background arc */}
        <path d={arcPath(0, 100)} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth + 2} strokeLinecap="round" />

        {/* Smooth gradient arc — many tiny segments */}
        {Array.from({ length: segments }, (_, i) => {
          const startPct = (i / segments) * 100;
          const endPct = ((i + 1) / segments) * 100 + 0.8; // overlap to eliminate visible gaps
          const midPct = (startPct + endPct) / 2;
          const color = getColorAtPosition(colorStops, midPct);
          return (
            <path
              key={i}
              d={arcPath(startPct, Math.min(endPct, 100))}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
            />
          );
        })}

        {/* Round end caps */}
        <path d={arcPath(0, 1.5)} fill="none" stroke={getColorAtPosition(colorStops, 0)} strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={arcPath(98.5, 100)} fill="none" stroke={getColorAtPosition(colorStops, 100)} strokeWidth={strokeWidth} strokeLinecap="round" />

        {/* Benchmark triangle + label */}
        {benchmarkPosition !== undefined && benchmarkLabel && (
          <>
            <polygon
              points={`${bmX},${bmY} ${bmX - 4},${bmY - 7} ${bmX + 4},${bmY - 7}`}
              fill="#4f46e5"
              transform={`rotate(${-(bmAngle - 90)}, ${bmX}, ${bmY})`}
            />
            <text
              x={bmLabelX}
              y={bmLabelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#4f46e5"
              fontSize="9"
              fontWeight="700"
            >
              {benchmarkLabel}
            </text>
          </>
        )}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#312e81" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#312e81" />
        <circle cx={cx} cy={cy} r="2.5" fill="white" />

        {/* Left/Right labels */}
        <text x={cx - radius - 2} y={cy + 15} textAnchor="middle" fill="#9ca3af" fontSize="9">
          {leftLabel}
        </text>
        <text x={cx + radius + 2} y={cy + 15} textAnchor="middle" fill="#9ca3af" fontSize="9">
          {rightLabel}
        </text>
      </svg>

      {/* Value display */}
      <div className="text-[14px] font-bold text-gray-800 -mt-3 text-center">
        {displayValue}
      </div>
    </div>
  );
}

// Helper: "higher is better" — red → orange → yellow → lime → green
export function higherIsBetterZones(greenStart: number, yellowStart: number): GaugeZone[] {
  const s = yellowStart;
  const g = greenStart;
  return [
    { start: 0, end: s * 0.5, color: "#dc2626" },
    { start: s * 0.5, end: s, color: "#f97316" },
    { start: s, end: (s + g) / 2, color: "#eab308" },
    { start: (s + g) / 2, end: g, color: "#84cc16" },
    { start: g, end: 100, color: "#16a34a" },
  ];
}

// Helper: "lower is better" — green → lime → yellow → orange → red
export function lowerIsBetterZones(greenEnd: number, yellowEnd: number): GaugeZone[] {
  const g = greenEnd;
  const y = yellowEnd;
  return [
    { start: 0, end: g, color: "#16a34a" },
    { start: g, end: (g + y) / 2, color: "#84cc16" },
    { start: (g + y) / 2, end: y, color: "#eab308" },
    { start: y, end: y + (100 - y) * 0.5, color: "#f97316" },
    { start: y + (100 - y) * 0.5, end: 100, color: "#dc2626" },
  ];
}

// Helper: Map a real value to 0-100 gauge position
export function mapToGauge(value: number, min: number, max: number): number {
  return Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
}
