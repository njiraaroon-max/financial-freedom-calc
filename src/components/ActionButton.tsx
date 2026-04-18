import type { ReactNode } from "react";

interface ActionButtonProps {
  label: string;
  successLabel?: string;
  onClick: () => void;
  hasCompleted?: boolean;
  variant?: "primary" | "danger" | "outline";
  icon?: ReactNode;
  className?: string;
}

export default function ActionButton({
  label,
  successLabel,
  onClick,
  hasCompleted = false,
  variant = "primary",
  icon,
  className = "",
}: ActionButtonProps) {
  const base =
    "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all";

  const variants: Record<string, { normal: string; success: string }> = {
    primary: {
      normal: "btn-gradient",
      success:
        "bg-green-100/80 backdrop-blur text-green-700 border border-green-300 shadow-none",
    },
    danger: {
      normal:
        "border-2 border-red-200 text-red-500 font-medium hover:bg-red-50/70 bg-white/40 backdrop-blur",
      success:
        "bg-green-100/80 backdrop-blur text-green-700 border border-green-300 shadow-none",
    },
    outline: {
      normal: "glass text-gray-700 hover:bg-white/70",
      success:
        "bg-green-100/80 backdrop-blur text-green-700 border border-green-300 shadow-none",
    },
  };

  const v = variants[variant] || variants.primary;
  const cls = hasCompleted && successLabel ? v.success : v.normal;

  return (
    <button onClick={onClick} className={`${base} ${cls} ${className}`}>
      {hasCompleted && successLabel ? successLabel : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}
