"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const HALF = Math.floor(VISIBLE_ITEMS / 2);

// ---------------------------------------------------------------------------
// Wheel Column (adapted from ThaiDatePicker)
// ---------------------------------------------------------------------------
function WheelColumn({
  items,
  selectedIndex,
  onSelect,
}: {
  items: { value: number; label: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
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
    if (Math.abs(velocity.current) > 0.3 && containerRef.current) {
      const momentum = velocity.current * 150;
      containerRef.current.scrollBy({ top: momentum, behavior: "smooth" });
    }
    setTimeout(handleScrollEnd, 200);
  };

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
    <div className="relative w-full" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      {/* Selection highlight */}
      <div
        className="absolute left-2 right-2 rounded-xl bg-blue-50 border border-blue-200 pointer-events-none z-0"
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
        <div style={{ height: HALF * ITEM_HEIGHT }} />
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.value}
              className={`flex items-center justify-center cursor-pointer select-none transition-all ${
                isSelected ? "text-gray-900 font-bold text-lg" : "text-gray-400 text-sm"
              }`}
              style={{ height: ITEM_HEIGHT, scrollSnapAlign: "start" }}
              onClick={() => { onSelect(idx); scrollToIndex(idx); }}
            >
              {item.label}
            </div>
          );
        })}
        <div style={{ height: HALF * ITEM_HEIGHT }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgeScrollPicker — modal with scroll wheel
// ---------------------------------------------------------------------------
interface AgeScrollPickerProps {
  value: string;
  onChange: (value: string) => void;
  minAge?: number;
  maxAge?: number;
  label?: string;
  placeholder?: string;
}

export default function AgeScrollPicker({
  value,
  onChange,
  minAge = 1,
  maxAge = 99,
  label,
  placeholder = "เลือกอายุ",
}: AgeScrollPickerProps) {
  const [open, setOpen] = useState(false);

  const ages = Array.from({ length: maxAge - minAge + 1 }, (_, i) => ({
    value: minAge + i,
    label: `${minAge + i} ปี`,
  }));

  const currentVal = parseInt(value) || minAge;
  const selectedIdx = Math.max(0, ages.findIndex((a) => a.value === currentVal));

  const handleSelect = (idx: number) => {
    onChange(String(ages[idx].value));
  };

  const displayText = value ? `${value} ปี` : "";

  return (
    <>
      {/* Trigger */}
      <div
        onClick={() => setOpen(true)}
        className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 text-center font-bold cursor-pointer hover:border-blue-300 transition flex items-center justify-center gap-2"
      >
        {displayText || <span className="text-gray-400 font-normal">{placeholder}</span>}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-sm md:rounded-2xl rounded-t-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-700">{label || "เลือกอายุ"}</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Wheel */}
            <div className="px-8 py-4">
              <WheelColumn items={ages} selectedIndex={selectedIdx} onSelect={handleSelect} />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition">
                ยกเลิก
              </button>
              <button onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] transition active:scale-95">
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
