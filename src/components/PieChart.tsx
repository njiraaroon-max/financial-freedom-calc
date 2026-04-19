"use client";

interface PieSlice {
  label: string;
  value: number;
  color: string;
  commonRatio?: number; // % relative to income
}

interface PieChartProps {
  title: string;
  slices: PieSlice[];
  /** Base (mobile) size in px. On md+ screens the chart scales via the
   *  `--pie-max` CSS variable — set it on a parent with Tailwind classes
   *  like `md:[--pie-max:190px] lg:[--pie-max:230px]`. Falls back to `size`. */
  size?: number;
}

// Generate shade palette — darker to lighter
function generateShades(baseHsl: [number, number], count: number): string[] {
  const shades: string[] = [];
  for (let i = 0; i < count; i++) {
    // Lightness from 30% (darkest/biggest) to 75% (lightest/smallest)
    const lightness = 30 + (i / Math.max(count - 1, 1)) * 45;
    // Slight saturation decrease for lighter shades
    const saturation = baseHsl[1] - (i / Math.max(count - 1, 1)) * 15;
    shades.push(`hsl(${baseHsl[0]}, ${saturation}%, ${lightness}%)`);
  }
  return shades;
}

// Green shades for income (hue ~145)
const INCOME_COLORS = generateShades([145, 70], 15);

// Red shades for expense (hue ~0)
const EXPENSE_COLORS = generateShades([0, 70], 15);

export { INCOME_COLORS, EXPENSE_COLORS };

export default function PieChart({ title, slices, size = 130 }: PieChartProps) {
  // Sort by value descending (biggest slice first)
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="text-[14px] md:text-[15px] font-bold text-gray-600 mb-2">{title}</div>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-auto"
          style={{ maxWidth: `var(--pie-max, ${size}px)` }}
        >
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="20" />
          <text x="50" y="52" textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize="10">
            ไม่มีข้อมูล
          </text>
        </svg>
      </div>
    );
  }

  const radius = 35;
  const cx = 50;
  const cy = 50;
  let currentAngle = -90; // Start from 12 o'clock, clockwise

  const paths = sorted
    .map((slice, idx) => {
      // Use shade based on sorted index (biggest = darkest)
      const color = slice.color || INCOME_COLORS[idx % INCOME_COLORS.length];
      const percentage = slice.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      const path =
        angle >= 359.9
          ? // Full circle
            `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      currentAngle = endAngle;

      return {
        path,
        color: slice.color,
        label: slice.label,
        percentage,
      };
    });

  return (
    <div className="flex flex-col items-center">
      <div className="text-[14px] md:text-[15px] font-bold text-gray-600 mb-2">{title}</div>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-auto"
        style={{ maxWidth: `var(--pie-max, ${size}px)` }}
      >
        {paths.map((p, i) => (
          <path key={i} d={p.path} fill={p.color} stroke="white" strokeWidth="0.5" />
        ))}
        {/* Center hole for donut */}
        <circle cx={cx} cy={cy} r="18" fill="white" />
        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle" fill="#374151" fontSize="7" fontWeight="800">
          {(total).toLocaleString("th-TH")}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize="5">
          บาท/ปี
        </text>
      </svg>

      {/* Legend — sorted by value desc. Legend max-width follows pie width. */}
      <div
        className="mt-2 w-full"
        style={{ maxWidth: `var(--pie-max, ${size}px)` }}
      >
        {sorted
          .slice(0, 6)
          .map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              <div
                className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[13px] md:text-[14px] text-gray-600 truncate flex-1">{s.label}</span>
              <span className="text-[13px] md:text-[14px] text-gray-700 whitespace-nowrap">
                <span className="font-bold">{total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%</span>
                {s.commonRatio !== undefined && (
                  <span className="text-gray-400 ml-0.5">(CR:{s.commonRatio.toFixed(0)}%)</span>
                )}
              </span>
            </div>
          ))}
        {sorted.length > 6 && (
          <div className="text-[12px] md:text-[13px] text-gray-400 text-center mt-0.5">
            +{sorted.length - 6} รายการ
          </div>
        )}
      </div>
    </div>
  );
}
