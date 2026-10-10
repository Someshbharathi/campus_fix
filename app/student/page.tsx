"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ClipboardList,
  FileText,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { StatCard } from "@/components/ui/stat-card";
import { VerificationBadge, ResolutionBadge, PriorityBadge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants";
import { ComplaintCategory, ResolutionStatus, VerificationStatus } from "@/lib/types";

export default function StudentDashboardPage() {
  const { currentUser, complaints } = useCampusFix();

  // Filter complaints for current student (or all if reviewing demo)
  const studentComplaints = useMemo(() => {
    return complaints.filter((c) => c.submittedBy.id === currentUser?.id);
  }, [complaints, currentUser]);

  // Stat metrics
  const totalCount = studentComplaints.length;
  const awaitingVerificationCount = studentComplaints.filter(
    (c) => c.verificationStatus === "awaiting_verification"
  ).length;
  const inProgressCount = studentComplaints.filter(
    (c) => c.resolutionStatus === "in_progress" || c.resolutionStatus === "pending_assignment"
  ).length;
  const resolvedCount = studentComplaints.filter(
    (c) => c.resolutionStatus === "resolved"
  ).length;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredComplaints = useMemo(() => {
    return studentComplaints.filter((item) => {
      // Search
      const matchesSearch =
        searchQuery === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.campusLocation.toLowerCase().includes(searchQuery.toLowerCase());

      // Status
      let matchesStatus = true;
      if (statusFilter === "awaiting_verification") {
        matchesStatus = item.verificationStatus === "awaiting_verification";
      } else if (statusFilter === "in_progress") {
        matchesStatus =
          item.resolutionStatus === "in_progress" ||
          item.resolutionStatus === "pending_assignment";
      } else if (statusFilter === "resolved") {
        matchesStatus = item.resolutionStatus === "resolved";
      } else if (statusFilter === "rejected") {
        matchesStatus = item.verificationStatus === "rejected";
      }

      // Category
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [studentComplaints, searchQuery, statusFilter, categoryFilter]);

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
      {/* Welcome & Quick Action Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
            Student Account: {currentUser?.rollNumber || "23BCE1048"}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {currentUser?.name || "Student"}!
          </h2>
          <p className="mt-1 text-sm text-slate-300 max-w-xl">
            Track your submitted campus complaints, review administrative verification notes, and inspect resolution timelines in real time.
          </p>
        </div>

        <Link
          href="/student/submit"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 shrink-0"
        >
          <PlusCircle className="h-5 w-5" />
          <span>Submit New Complaint</span>
        </Link>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Total Complaints"
          count={totalCount}
          icon={<ClipboardList className="h-5 w-5" />}
          subtitle="All lifetime tickets"
          colorScheme="slate"
          onClick={() => setStatusFilter("all")}
          isActive={statusFilter === "all"}
        />
        <StatCard
          title="Awaiting Verification"
          count={awaitingVerificationCount}
          icon={<Clock className="h-5 w-5" />}
          subtitle="Under admin inspection"
          colorScheme="amber"
          onClick={() => setStatusFilter("awaiting_verification")}
          isActive={statusFilter === "awaiting_verification"}
        />
        <StatCard
          title="In Progress"
          count={inProgressCount}
          icon={<RotateCcw className="h-5 w-5" />}
          subtitle="Technicians dispatched"
          colorScheme="sky"
          onClick={() => setStatusFilter("in_progress")}
          isActive={statusFilter === "in_progress"}
        />
        <StatCard
          title="Resolved"
          count={resolvedCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          subtitle="Completed and verified"
          colorScheme="emerald"
          onClick={() => setStatusFilter("resolved")}
          isActive={statusFilter === "resolved"}
        />
      </div>

      {/* Recent Complaints Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Recent Complaints
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing {filteredComplaints.length} of {studentComplaints.length} recorded complaints
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket ID or issue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="all">All Statuses</option>
              <option value="awaiting_verification">Awaiting Verification</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>

            {(searchQuery || statusFilter !== "all" || categoryFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                }}
                className="h-9 px-3 text-xs text-rose-600 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-950/40 transition-colors font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Complaints Table */}
        {filteredComplaints.length === 0 ? (
          <div className="py-16 text-center px-4">
            <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              No matching complaints found
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your search query or status filters to find your ticket."
                : "You haven't logged any campus issues yet. Click below to submit your first complaint."}
            </p>
            <Link
              href="/student/submit"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Submit a Complaint
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <th className="py-3.5 px-4 sm:px-6">Complaint ID</th>
                  <th className="py-3.5 px-4">Title & Details</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Category</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Submitted</th>
                  <th className="py-3.5 px-4">Verification</th>
                  <th className="py-3.5 px-4">Resolution</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Priority</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredComplaints.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    {/* Complaint ID */}
                    <td className="py-4 px-4 sm:px-6 font-mono font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      <Link
                        href={`/student/complaints/${item.id}`}
                        className="hover:underline flex items-center gap-1"
                      >
                        {item.id}
                      </Link>
                    </td>

                    {/* Title & Location */}
                    <td className="py-4 px-4 max-w-xs sm:max-w-md">
                      <Link
                        href={`/student/complaints/${item.id}`}
                        className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block truncate"
                        title={item.title}
                      >
                        {item.title}
                      </Link>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.campusLocation} • {item.specificLocation}
                      </p>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4 hidden md:table-cell whitespace-nowrap">
                      <span className="capitalize text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        {CATEGORIES.find((c) => c.id === item.category)?.label || item.category}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 hidden sm:table-cell text-slate-500 whitespace-nowrap">
                      {formatDate(item.submittedAt)}
                    </td>

                    {/* Verification Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <VerificationBadge status={item.verificationStatus} size="sm" />
                    </td>

                    {/* Resolution Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <ResolutionBadge status={item.resolutionStatus} size="sm" />
                    </td>

                    {/* Priority */}
                    <td className="py-4 px-4 hidden lg:table-cell whitespace-nowrap">
                      <PriorityBadge priority={item.priority} size="sm" />
                    </td>

                    {/* View Action */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                      <Link
                        href={`/student/complaints/${item.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-all hover:scale-105"
                      >
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
