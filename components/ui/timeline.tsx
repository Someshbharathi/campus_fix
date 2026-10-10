import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Wrench,
  XCircle,
  HelpCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import { TimelineEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TimelineProps {
  events: TimelineEvent[];
  verificationStatus: string;
  resolutionStatus: string;
}

export function VerticalTimeline({
  events,
  verificationStatus,
  resolutionStatus,
}: TimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
        <Clock className="mx-auto h-8 w-8 text-slate-400" />
        <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          No timeline records yet
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Status progression will be recorded here once reviewed by administration.
        </p>
      </div>
    );
  }

  const getEventIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "created":
        return <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case "verified":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
      case "assigned":
        return <UserCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
      case "progress":
        return <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "info_requested":
      case "info_provided":
        return <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "reopened":
        return <RefreshCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
      default:
        return <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getEventBg = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "created":
        return "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-800";
      case "verified":
      case "resolved":
        return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800";
      case "rejected":
        return "bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800";
      case "assigned":
        return "bg-sky-50 border-sky-200 dark:bg-sky-950/60 dark:border-sky-800";
      case "progress":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800";
      case "info_requested":
      case "info_provided":
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800";
      case "reopened":
        return "bg-orange-50 border-orange-200 dark:bg-orange-950/60 dark:border-orange-800";
      default:
        return "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800";
    }
  };

  const formatEventDate = (timestamp: string) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          return (
            <li key={event.id || idx}>
              <div className="relative pb-8">
                {/* Connector line */}
                {!isLast && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-800"
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex items-start space-x-3.5">
                  {/* Icon node */}
                  <div>
                    <span
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 border",
                        getEventBg(event.type)
                      )}
                    >
                      {getEventIcon(event.type)}
                    </span>
                  </div>

                  {/* Event content box */}
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {event.title}
                      </p>
                      <time className="text-xs text-slate-500 dark:text-slate-400">
                        {formatEventDate(event.timestamp)}
                      </time>
                    </div>

                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {event.description}
                    </p>

                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Action by:
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {event.actor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
