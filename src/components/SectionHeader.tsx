"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}

export default function SectionHeader({
  title,
  subtitle,
  icon,
  rightElement,
  collapsible = false,
  defaultOpen = true,
  isOpen: controlledOpen,
  onToggle: controlledToggle,
  children,
}: SectionHeaderProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const toggle = isControlled
    ? controlledToggle
    : () => setInternalOpen((p) => !p);

  const headerContent = (
    <>
      <div className="text-left flex items-center gap-2">
        {icon}
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle && (
            <div className="text-[13px] opacity-60 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {rightElement}
        {collapsible && (
          open ? <ChevronUp size={18} /> : <ChevronDown size={18} />
        )}
      </div>
    </>
  );

  return (
    <div>
      {collapsible ? (
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-[#1e3a5f] text-white rounded-t-xl"
        >
          {headerContent}
        </button>
      ) : (
        <div className="w-full flex items-center justify-between px-4 py-3.5 bg-[#1e3a5f] text-white rounded-t-xl">
          {headerContent}
        </div>
      )}
      {(!collapsible || open) && children}
    </div>
  );
}
