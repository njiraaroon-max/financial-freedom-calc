"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.",
  "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.",
  "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function toThaiDate(isoDate: string): { day: number; month: number; year: number } {
  if (!isoDate) {
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() + 543 };
  }
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() + 543 };
  }
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() + 543 };
}

function toISO(day: number, month: number, thaiYear: number): string {
  const ceYear = thaiYear - 543;
  const maxDay = daysInMonth(month, ceYear);
  const safeDay = Math.min(day, maxDay);
  const mm = String(month).padStart(2, "0");
  const dd = String(safeDay).padStart(2, "0");
  return `${ceYear}-${mm}-${dd}`;
}

function formatThaiDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const { day, month, year } = toThaiDate(isoDate);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year}`;
}

// ---------------------------------------------------------------------------
// Wheel Column Component
// ---------------------------------------------------------------------------

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const HALF = Math.floor(VISIBLE_ITEMS / 2);

function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  width = "flex-1",
}: {
  items: { value: number; label: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const animFrame = useRef<number>(0);

  const scrollToIndex = useCallback((idx: number, smooth = true) => {
    if (!containerRef.current) return;
    const target = idx * ITEM_HEIGHT;
    if (smooth) {
      containerRef.current.scrollTo({ top: target, behavior: "smooth" });
    } else {
      containerRef.current.scrollTop = target;
    }
  }, []);

  // Initial scroll
  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, scrollToIndex]);

  const handleScrollEnd = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const nearestIdx = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(nearestIdx, items.length - 1));
    scrollToIndex(clampedIdx);
    if (clampedIdx !== selectedIndex) {
      onSelect(clampedIdx);
    }
  }, [items.length, selectedIndex, onSelect, scrollToIndex]);

  // Scroll snap on scroll end
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timeout: NodeJS.Timeout;
    const onScroll = () => {
      clearTimeout(timeout);
      if (!isDragging.current) {
        timeout = setTimeout(handleScrollEnd, 80);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(timeout);
    };
  }, [handleScrollEnd]);

  // Touch handlers for momentum
  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startScroll.current = containerRef.current?.scrollTop || 0;
    lastY.current = e.touches[0].clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
    cancelAnimationFrame(animFrame.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;
    containerRef.current.scrollTop = startScroll.current + diff;

    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = (lastY.current - currentY) / dt;
    }
    lastY.current = currentY;
    lastTime.current = now;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    // Apply momentum
    if (Math.abs(velocity.current) > 0.3 && containerRef.current) {
      const momentum = velocity.current * 150;
      containerRef.current.scrollBy({ top: momentum, behavior: "smooth" });
    }
    setTimeout(handleScrollEnd, 200);
  };

  // Mouse handlers (for desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startScroll.current = containerRef.current?.scrollTop || 0;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const diff = startY.current - e.clientY;
      containerRef.current.scrollTop = startScroll.current + diff;
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setTimeout(handleScrollEnd, 100);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleScrollEnd]);

  return (
    <div className={`${width} relative`} style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      {/* Selection highlight */}
      <div
        className="absolute left-1 right-1 rounded-xl bg-gray-100 pointer-events-none z-0"
        style={{ top: HALF * ITEM_HEIGHT, height: ITEM_HEIGHT }}
      />

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />

      {/* Scrollable list */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto scrollbar-hide z-5"
        style={{ scrollSnapType: "y mandatory" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {/* Top padding */}
        <div style={{ height: HALF * ITEM_HEIGHT }} />

        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.value}
              className={`flex items-center justify-center cursor-pointer select-none transition-all ${
                isSelected
                  ? "text-gray-900 font-bold text-base"
                  : "text-gray-400 text-sm"
              }`}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "start",
              }}
              onClick={() => {
                onSelect(idx);
                scrollToIndex(idx);
              }}
            >
              {item.label}
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: HALF * ITEM_HEIGHT }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DatePicker Component
// ---------------------------------------------------------------------------

interface ThaiDatePickerProps {
  value: string; // ISO format YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minYear?: number; // Thai year
  maxYear?: number; // Thai year
  className?: string;
}

export default function ThaiDatePicker({
  value,
  onChange,
  label,
  placeholder = "เลือกวันที่",
  minYear = 2490,
  maxYear = 2650,
  className = "",
}: ThaiDatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = toThaiDate(value);
  const [selDay, setSelDay] = useState(parsed.day);
  const [selMonth, setSelMonth] = useState(parsed.month);
  const [selYear, setSelYear] = useState(parsed.year);

  // When opening, sync with current value
  useEffect(() => {
    if (open) {
      const p = toThaiDate(value);
      setSelDay(p.day);
      setSelMonth(p.month);
      setSelYear(p.year);
    }
  }, [open, value]);

  // Generate items
  const ceYear = selYear - 543;
  const maxDays = daysInMonth(selMonth, ceYear);
  const safeDay = Math.min(selDay, maxDays);

  const dayItems = Array.from({ length: maxDays }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));

  const monthItems = THAI_MONTHS.map((name, i) => ({
    value: i + 1,
    label: name,
  }));

  const yearItems = Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({
    value: minYear + i,
    label: String(minYear + i),
  }));

  function handleConfirm() {
    const iso = toISO(safeDay, selMonth, selYear);
    onChange(iso);
    setOpen(false);
  }

  function handleCancel() {
    setOpen(false);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 w-full text-left bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-gray-200 focus:ring-2 focus:ring-emerald-400 transition-all ${className}`}
      >
        <Calendar size={14} className="text-gray-400 shrink-0" />
        <span className={`text-xs flex-1 ${value ? "text-gray-800 font-semibold" : "text-gray-400"}`}>
          {value ? formatThaiDisplay(value) : placeholder}
        </span>
      </button>

      {/* Picker Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />
          <div className="glass relative w-full md:max-w-sm rounded-t-3xl md:rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-sm font-bold text-gray-800">{label || "เลือกวันที่"}</span>
              <button onClick={handleCancel} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={14} className="text-gray-500" />
              </button>
            </div>

            {/* Preview */}
            <div className="text-center py-1">
              <span className="text-xs text-emerald-600 font-semibold">
                {safeDay} {THAI_MONTHS[selMonth - 1]} {selYear}
              </span>
            </div>

            {/* Wheel columns */}
            <div className="flex gap-0 px-4">
              <WheelColumn
                items={dayItems}
                selectedIndex={safeDay - 1}
                onSelect={(idx) => setSelDay(idx + 1)}
                width="w-20"
              />
              <WheelColumn
                items={monthItems}
                selectedIndex={selMonth - 1}
                onSelect={(idx) => setSelMonth(idx + 1)}
              />
              <WheelColumn
                items={yearItems}
                selectedIndex={selYear - minYear}
                onSelect={(idx) => setSelYear(minYear + idx)}
                width="w-24"
              />
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 mt-2">
              <button
                onClick={handleCancel}
                className="text-sm font-semibold text-blue-500 px-4 py-2"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirm}
                className="text-sm font-bold text-blue-600 px-4 py-2 bg-blue-50 rounded-xl"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
