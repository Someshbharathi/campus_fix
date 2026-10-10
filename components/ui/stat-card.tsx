import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  colorScheme?: "slate" | "amber" | "sky" | "emerald" | "rose" | "indigo";
  onClick?: () => void;
  isActive?: boolean;
}

export function StatCard({
  title,
  count,
  icon,
  subtitle,
  trend,
  trendPositive,
  colorScheme = "slate",
  onClick,
  isActive,
}: StatCardProps) {
  const schemeStyles = {
    slate: {
      bg: "bg-white dark:bg-slate-900",
      border: "border-slate-200 dark:border-slate-800",
      iconBg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      countText: "text-slate-900 dark:text-slate-50",
      activeBorder: "ring-2 ring-slate-800 border-transparent",
    },
    amber: {
      bg: "bg-amber-50/40 dark:bg-amber-950/20",
      border: "border-amber-200/80 dark:border-amber-900/60",
      iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
      countText: "text-amber-900 dark:text-amber-200",
      activeBorder: "ring-2 ring-amber-500 border-transparent",
    },
    sky: {
      bg: "bg-sky-50/40 dark:bg-sky-950/20",
      border: "border-sky-200/80 dark:border-sky-900/60",
      iconBg: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
      countText: "text-sky-900 dark:text-sky-200",
      activeBorder: "ring-2 ring-sky-500 border-transparent",
    },
    emerald: {
      bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
      border: "border-emerald-200/80 dark:border-emerald-900/60",
      iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
      countText: "text-emerald-900 dark:text-emerald-200",
      activeBorder: "ring-2 ring-emerald-500 border-transparent",
    },
    rose: {
      bg: "bg-rose-50/40 dark:bg-rose-950/20",
      border: "border-rose-200/80 dark:border-rose-900/60",
      iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
      countText: "text-rose-900 dark:text-rose-200",
      activeBorder: "ring-2 ring-rose-500 border-transparent",
    },
    indigo: {
      bg: "bg-indigo-50/40 dark:bg-indigo-950/20",
      border: "border-indigo-200/80 dark:border-indigo-900/60",
      iconBg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
      countText: "text-indigo-900 dark:text-indigo-200",
      activeBorder: "ring-2 ring-indigo-500 border-transparent",
    },
  };

  const scheme = schemeStyles[colorScheme];

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-5 transition-all shadow-xs",
        scheme.bg,
        scheme.border,
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        isActive && scheme.activeBorder
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={cn("p-2.5 rounded-xl transition-colors", scheme.iconBg)}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className={cn("text-3xl font-bold tracking-tight", scheme.countText)}>
          {count}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-md",
              trendPositive
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
