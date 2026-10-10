import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="w-full">
        <select
          className={cn(
            "flex h-10 w-full appearance-none rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100",
            error
              ? "border-rose-400 focus-visible:ring-rose-500 dark:border-rose-500"
              : "border-slate-200 dark:border-slate-800",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
