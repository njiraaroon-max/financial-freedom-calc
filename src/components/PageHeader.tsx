import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  characterImg?: string;
  icon?: React.ReactNode;
  backHref?: string;
  rightElement?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  characterImg,
  icon,
  backHref = "/",
  rightElement,
}: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className={`flex items-center ${rightElement ? "justify-between" : "gap-3"} px-4 md:px-8 py-3`}>
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition"
          >
            <ArrowLeft size={20} />
          </Link>
          {characterImg && (
            <img
              src={characterImg}
              alt={title}
              className="w-16 h-16 object-contain"
            />
          )}
          {icon && !characterImg && icon}
          <div>
            <h1 className="text-lg font-bold">{title}</h1>
            {subtitle && (
              <p className="text-[10px] text-gray-400">{subtitle}</p>
            )}
          </div>
        </div>
        {rightElement && <div className="shrink-0">{rightElement}</div>}
      </div>
    </div>
  );
}
