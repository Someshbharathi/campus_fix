"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Calendar,
  Building,
  MapPin,
  ExternalLink,
  Search,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { Complaint } from "@/lib/types";
import { PriorityBadge, ResolutionBadge } from "@/components/ui/badge";

export default function AuthorityCompletedPage() {
  const { complaints } = useCampusFix();
  const [searchQuery, setSearchQuery] = useState("");

  const resolvedTasks = useMemo(() => {
    return complaints.filter((c) => {
      if (c.resolutionStatus !== "resolved") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.campusLocation.toLowerCase().includes(q) ||
          (c.resolutionNotes && c.resolutionNotes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [complaints, searchQuery]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Field Operations Archive
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Completed & Resolved Tasks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit history of all fixed campus issues certified by maintenance authorities.
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          {resolvedTasks.length} Total Resolved
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search resolved tickets by ID, title, or resolution notes..."
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
        />
      </div>

      {/* Resolved Tasks Cards */}
      {resolvedTasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            No Resolved Tasks Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Completed tickets certified by technicians will be archived here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {resolvedTasks.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-xs dark:border-emerald-900/50 dark:bg-slate-900 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-900">
                    {task.id}
                  </span>
                  <PriorityBadge priority={task.priority} size="sm" />
                  <ResolutionBadge status={task.resolutionStatus} size="sm" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
                    {task.assignedDepartment || "Maintenance"}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Resolved: {formatDate(task.resolvedAt || task.updatedAt)}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {task.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {task.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    {task.campusLocation}
                  </span>
                  <span>•</span>
                  <span>{task.specificLocation}</span>
                </div>
              </div>

              {/* Resolution Summary Box */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Technical Resolution Certification
                  </span>
                  {task.resolutionProofUrl && (
                    <a
                      href={task.resolutionProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 dark:text-emerald-300 font-semibold hover:underline flex items-center gap-1"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Inspect Proof Image ↗</span>
                    </a>
                  )}
                </div>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  {task.resolutionNotes || "Fix completed on-site and verified functional."}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href={`/authority/complaints/${task.id}`}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-1"
                >
                  <span>View Timeline Audit</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
