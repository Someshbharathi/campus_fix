import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  charCount?: number;
  maxChars?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, charCount, maxChars, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          className={cn(
            "flex min-h-[100px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
            error
              ? "border-rose-400 focus-visible:ring-rose-500 dark:border-rose-500"
              : "border-slate-200 dark:border-slate-800",
            className
          )}
          ref={ref}
          {...props}
        />
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          {error ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
          ) : (
            <span />
          )}
          {typeof charCount === "number" && typeof maxChars === "number" && (
            <span
              className={cn(
                "text-xs ml-auto",
                charCount > maxChars
                  ? "text-rose-600 font-medium"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {charCount} / {maxChars} characters
            </span>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
