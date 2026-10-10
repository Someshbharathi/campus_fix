import React from "react";
import { cn } from "@/lib/utils";
import { Priority, ResolutionStatus, VerificationStatus } from "@/lib/types";
import { PRIORITY_META, RESOLUTION_STATUS_META, VERIFICATION_STATUS_META } from "@/lib/constants";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
  size?: "sm" | "md" | "lg";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium rounded-md",
    md: "px-2.5 py-1 text-xs font-medium rounded-full",
    lg: "px-3 py-1.5 text-sm font-semibold rounded-full",
  };

  const variantClasses = {
    default: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
    secondary: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    outline: "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
    destructive: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800",
    warning: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors border",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function VerificationBadge({
  status,
  size = "md",
  showDot = true,
}: {
  status: VerificationStatus;
  size?: "sm" | "md";
  showDot?: boolean;
}) {
  const meta = VERIFICATION_STATUS_META[status] || VERIFICATION_STATUS_META.awaiting_verification;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-full transition-all",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.badgeClass
      )}
      title={meta.description}
    >
      {showDot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            status === "verified"
              ? "bg-emerald-500"
              : status === "rejected"
              ? "bg-rose-500"
              : status === "info_requested"
              ? "bg-blue-500"
              : "bg-amber-500 animate-pulse"
          )}
        />
      )}
      {meta.label}
    </span>
  );
}

export function ResolutionBadge({
  status,
  size = "md",
}: {
  status: ResolutionStatus;
  size?: "sm" | "md";
}) {
  const meta = RESOLUTION_STATUS_META[status] || RESOLUTION_STATUS_META.submitted;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-full transition-all",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.badgeClass
      )}
      title={meta.description}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "resolved"
            ? "bg-emerald-500"
            : status === "in_progress"
            ? "bg-sky-500 animate-ping"
            : status === "pending_assignment"
            ? "bg-indigo-500"
            : status === "rejected"
            ? "bg-rose-500"
            : "bg-slate-400"
        )}
      />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({
  priority,
  size = "md",
}: {
  priority: Priority;
  size?: "sm" | "md";
}) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-full",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.badgeClass
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}
