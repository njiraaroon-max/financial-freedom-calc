"use client";

import { useRef, useEffect } from "react";

const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

interface MonthNavigatorProps {
  currentMonth: number;
  onChangeMonth: (month: number) => void;
}

export default function MonthNavigator({
  currentMonth,
  onChangeMonth,
}: MonthNavigatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const btn = btnRefs.current[currentMonth];
    if (btn && scrollRef.current) {
      const container = scrollRef.current;
      const scrollLeft = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [currentMonth]);

  return (
    <div className="bg-white sticky top-0 z-10 border-b border-[var(--color-border)]">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide px-2 py-2 gap-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {MONTH_SHORT.map((name, i) => (
          <button
            key={i}
            ref={(el) => { btnRefs.current[i] = el; }}
            onClick={() => onChangeMonth(i)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              i === currentMonth
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
