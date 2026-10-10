"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building,
  PieChart,
  ArrowLeft,
  Calendar,
  Layers,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { CATEGORIES, DEPARTMENTS } from "@/lib/constants";
import { ComplaintCategory } from "@/lib/types";

export default function AdminReportsPage() {
  const { complaints } = useCampusFix();

  const total = complaints.length;
  const verifiedCount = complaints.filter(
    (c) => c.verificationStatus === "verified"
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.resolutionStatus === "resolved"
  ).length;
  const awaitingCount = complaints.filter(
    (c) => c.verificationStatus === "awaiting_verification"
  ).length;

  const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
  const verificationRate = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

  // Category counts
  const categoryStats = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const count = complaints.filter((c) => c.category === cat.id).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        ...cat,
        count,
        percentage,
      };
    }).sort((a, b) => b.count - a.count);
  }, [complaints, total]);

  // Department Workload counts
  const departmentStats = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const assigned = complaints.filter((c) => c.assignedDepartment === dept).length;
      const resolved = complaints.filter(
        (c) => c.assignedDepartment === dept && c.resolutionStatus === "resolved"
      ).length;
      return {
        department: dept,
        assigned,
        resolved,
      };
    }).filter((d) => d.assigned > 0);
  }, [complaints]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Institutional Grievance Metrics
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              CampusFix Analytics & Resolution Trends
            </h2>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Resolution Rate
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {resolutionRate}%
            </span>
            <span className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md font-semibold">
              {resolvedCount}/{total} Closed
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${resolutionRate}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Verification Rate
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {verificationRate}%
            </span>
            <span className="text-xs text-indigo-700 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md font-semibold">
              {verifiedCount} Verified
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${verificationRate}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Avg Turnaround Time
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              18.4 hrs
            </span>
            <span className="text-xs text-sky-700 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded-md font-semibold">
              Within 24h SLA
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            From verified dispatch to technician sign-off
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pending Screening
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {awaitingCount}
            </span>
            <span className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md font-semibold">
              Needs Review
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Tickets in administrative verification queue
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              Complaints by Infrastructure Category
            </h3>
            <span className="text-xs text-slate-400">{categoryStats.length} Domains</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {categoryStats.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800 dark:text-slate-200">{item.label}</span>
                  <span className="text-slate-500">
                    {item.count} tickets ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${Math.max(item.percentage, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Department Workload Allocation Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Building className="h-4 w-4 text-amber-600" />
              Department Workload & Completion
            </h3>
            <span className="text-xs text-slate-400">Assigned Queues</span>
          </div>

          <div className="space-y-4 pt-1">
            {departmentStats.map((dept) => {
              const compPercent =
                dept.assigned > 0 ? Math.round((dept.resolved / dept.assigned) * 100) : 0;
              return (
                <div
                  key={dept.department}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {dept.department}
                    </span>
                    <span className="font-semibold text-slate-500">
                      {dept.resolved} of {dept.assigned} resolved
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${compPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
