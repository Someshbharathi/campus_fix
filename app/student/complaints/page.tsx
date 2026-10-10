"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  FileText,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  Building,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { VerificationBadge, ResolutionBadge, PriorityBadge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants";
import { ResolutionStatus, VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function MyComplaintsPage() {
  const { currentUser, complaints } = useCampusFix();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Filter complaints by student
  const studentComplaints = useMemo(() => {
    return complaints.filter((c) => c.submittedBy.id === currentUser?.id);
  }, [complaints, currentUser]);

  const tabs = [
    { id: "all", label: "All Complaints", count: studentComplaints.length },
    {
      id: "awaiting_verification",
      label: "Awaiting Verification",
      count: studentComplaints.filter((c) => c.verificationStatus === "awaiting_verification").length,
    },
    {
      id: "verified",
      label: "Verified",
      count: studentComplaints.filter((c) => c.verificationStatus === "verified").length,
    },
    {
      id: "in_progress",
      label: "In Progress",
      count: studentComplaints.filter(
        (c) => c.resolutionStatus === "in_progress" || c.resolutionStatus === "pending_assignment"
      ).length,
    },
    {
      id: "resolved",
      label: "Resolved",
      count: studentComplaints.filter((c) => c.resolutionStatus === "resolved").length,
    },
    {
      id: "rejected",
      label: "Rejected",
      count: studentComplaints.filter((c) => c.verificationStatus === "rejected").length,
    },
  ];

  const filteredComplaints = useMemo(() => {
    return studentComplaints
      .filter((item) => {
        // Tab Filter
        if (activeTab === "awaiting_verification") {
          if (item.verificationStatus !== "awaiting_verification") return false;
        } else if (activeTab === "verified") {
          if (item.verificationStatus !== "verified") return false;
        } else if (activeTab === "in_progress") {
          if (
            item.resolutionStatus !== "in_progress" &&
            item.resolutionStatus !== "pending_assignment"
          )
            return false;
        } else if (activeTab === "resolved") {
          if (item.resolutionStatus !== "resolved") return false;
        } else if (activeTab === "rejected") {
          if (item.verificationStatus !== "rejected") return false;
        }

        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            item.title.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q) ||
            item.campusLocation.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Category
        if (categoryFilter !== "all" && item.category !== categoryFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.submittedAt).getTime();
        const timeB = new Date(b.submittedAt).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [studentComplaints, activeTab, searchQuery, categoryFilter, sortOrder]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Campus Complaints
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track verification progress, review assigned technicians, and confirm resolution status.
          </p>
        </div>

        <Link
          href="/student/submit"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Complaint</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all border",
                isActive
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket ID, keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 flex-1 sm:flex-initial"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Sort Order */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
          </button>
        </div>
      </div>

      {/* Complaints List / Cards */}
      {filteredComplaints.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No complaints in this view
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Try switching filter tabs or search queries to locate your tickets.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredComplaints.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all group"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Left Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900">
                      {item.id}
                    </span>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Submitted {formatDate(item.submittedAt)}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                      {CATEGORIES.find((c) => c.id === item.category)?.label}
                    </span>
                  </div>

                  <Link
                    href={`/student/complaints/${item.id}`}
                    className="block text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                  >
                    {item.title}
                  </Link>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      {item.campusLocation}
                    </span>
                    <span>•</span>
                    <span>{item.specificLocation}</span>
                  </div>
                </div>

                {/* Right Statuses & Action */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center md:justify-end gap-1.5">
                    {/* Verification Badge */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 hidden lg:inline">
                        Verification:
                      </span>
                      <VerificationBadge status={item.verificationStatus} size="sm" />
                    </div>

                    {/* Resolution Badge */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 hidden lg:inline">
                        Resolution:
                      </span>
                      <ResolutionBadge status={item.resolutionStatus} size="sm" />
                    </div>
                  </div>

                  <Link
                    href={`/student/complaints/${item.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-all hover:scale-105"
                  >
                    <span>Track Progress</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
