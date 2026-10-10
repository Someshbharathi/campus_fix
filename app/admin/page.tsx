"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckSquare,
  Clock,
  UserCheck,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  Building,
  ChevronRight,
  ExternalLink,
  Users,
  RotateCcw,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { StatCard } from "@/components/ui/stat-card";
import { VerificationBadge, ResolutionBadge, PriorityBadge } from "@/components/ui/badge";
import { CATEGORIES, DEPARTMENTS } from "@/lib/constants";
import { Priority, ResolutionStatus, VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { complaints, currentUser } = useCampusFix();

  // Metric counts
  const totalCount = complaints.length;
  const awaitingVerificationCount = complaints.filter(
    (c) => c.verificationStatus === "awaiting_verification"
  ).length;
  const pendingAssignmentCount = complaints.filter(
    (c) =>
      c.verificationStatus === "verified" &&
      (c.resolutionStatus === "pending_assignment" || !c.assignedDepartment)
  ).length;
  const inProgressCount = complaints.filter(
    (c) => c.resolutionStatus === "in_progress"
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.resolutionStatus === "resolved"
  ).length;
  const overdueCount = complaints.filter((c) => c.isOverdue || c.priority === "critical").length;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.submittedBy.name.toLowerCase().includes(q) ||
          (item.submittedBy.rollNumber &&
            item.submittedBy.rollNumber.toLowerCase().includes(q)) ||
          item.campusLocation.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Verification
      if (
        verificationFilter !== "all" &&
        item.verificationStatus !== verificationFilter
      ) {
        return false;
      }

      // Status
      if (statusFilter !== "all" && item.resolutionStatus !== statusFilter) {
        return false;
      }

      // Department
      if (departmentFilter !== "all" && item.assignedDepartment !== departmentFilter) {
        return false;
      }

      // Priority
      if (priorityFilter !== "all" && item.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [
    complaints,
    searchQuery,
    verificationFilter,
    statusFilter,
    departmentFilter,
    priorityFilter,
  ]);

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
      {/* Admin Top Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-6 sm:p-8 text-white shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold mb-3 border border-amber-500/30">
            Staff Authority: Estate & Grievance Cell
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Administrator Oversight Console
          </h2>
          <p className="mt-1 text-sm text-slate-300 max-w-xl leading-relaxed">
            Review incoming student grievance tickets, conduct initial verification, dispatch departmental technicians, and ensure SLA accountability.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/admin/verification"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-lg shadow-amber-600/30 transition-all hover:scale-105"
          >
            <CheckSquare className="h-5 w-5" />
            <span>Review Verification Queue ({awaitingVerificationCount})</span>
          </Link>
        </div>
      </div>

      {/* 6 Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Total"
          count={totalCount}
          icon={<ShieldCheck className="h-4 w-4" />}
          subtitle="All complaints"
          colorScheme="slate"
          onClick={() => {
            setVerificationFilter("all");
            setStatusFilter("all");
          }}
          isActive={verificationFilter === "all" && statusFilter === "all"}
        />
        <StatCard
          title="Awaiting Verify"
          count={awaitingVerificationCount}
          icon={<Clock className="h-4 w-4" />}
          subtitle="Needs review"
          colorScheme="amber"
          onClick={() => {
            setVerificationFilter("awaiting_verification");
            setStatusFilter("all");
          }}
          isActive={verificationFilter === "awaiting_verification"}
        />
        <StatCard
          title="Pending Assign"
          count={pendingAssignmentCount}
          icon={<UserCheck className="h-4 w-4" />}
          subtitle="Verified tickets"
          colorScheme="indigo"
          onClick={() => {
            setVerificationFilter("verified");
            setStatusFilter("pending_assignment");
          }}
          isActive={statusFilter === "pending_assignment"}
        />
        <StatCard
          title="In Progress"
          count={inProgressCount}
          icon={<Wrench className="h-4 w-4" />}
          subtitle="Technicians active"
          colorScheme="sky"
          onClick={() => {
            setVerificationFilter("all");
            setStatusFilter("in_progress");
          }}
          isActive={statusFilter === "in_progress"}
        />
        <StatCard
          title="Resolved"
          count={resolvedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          subtitle="Fixed & verified"
          colorScheme="emerald"
          onClick={() => {
            setVerificationFilter("all");
            setStatusFilter("resolved");
          }}
          isActive={statusFilter === "resolved"}
        />
        <StatCard
          title="Critical / Urg"
          count={overdueCount}
          icon={<AlertTriangle className="h-4 w-4" />}
          subtitle="Immediate hazard"
          colorScheme="rose"
          onClick={() => {
            setPriorityFilter("critical");
          }}
          isActive={priorityFilter === "critical"}
        />
      </div>

      {/* Admin Complaint Table Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Table Control Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Institutional Complaints Register
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Showing {filteredComplaints.length} of {complaints.length} total recorded campus tickets
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/reports"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
              >
                <span>Analytics Trends</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Multilateral Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket ID, student name, keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Verification Filter */}
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="all">All Verification</option>
              <option value="awaiting_verification">Awaiting Verification</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="info_requested">Info Requested</option>
            </select>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        {filteredComplaints.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-3 opacity-40 text-slate-400" />
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              No matching complaints
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Adjust your filters or search terms to inspect other complaints.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <th className="py-3.5 px-4 sm:px-6">Ticket ID</th>
                  <th className="py-3.5 px-4">Title & Details</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Student</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Location</th>
                  <th className="py-3.5 px-4">Verification</th>
                  <th className="py-3.5 px-4">Resolution Status</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Priority</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredComplaints.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    {/* Ticket ID */}
                    <td className="py-4 px-4 sm:px-6 font-mono font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      <Link
                        href={`/admin/complaints/${item.id}`}
                        className="hover:underline flex items-center gap-1"
                      >
                        {item.id}
                      </Link>
                    </td>

                    {/* Title & Category */}
                    <td className="py-4 px-4 max-w-xs sm:max-w-md">
                      <Link
                        href={`/admin/complaints/${item.id}`}
                        className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block truncate"
                        title={item.title}
                      >
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="capitalize font-medium text-slate-600 dark:text-slate-400">
                          {CATEGORIES.find((c) => c.id === item.category)?.label || item.category}
                        </span>
                        <span>•</span>
                        <span>Dept: {item.assignedDepartment || "Unassigned"}</span>
                      </div>
                    </td>

                    {/* Student */}
                    <td className="py-4 px-4 hidden md:table-cell whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.submittedBy.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.submittedBy.rollNumber || item.submittedBy.email}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-4 px-4 hidden lg:table-cell text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div className="truncate max-w-[180px]">{item.campusLocation}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {item.specificLocation}
                      </div>
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
                    <td className="py-4 px-4 hidden sm:table-cell whitespace-nowrap">
                      <PriorityBadge priority={item.priority} size="sm" />
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {item.verificationStatus === "awaiting_verification" ? (
                          <Link
                            href="/admin/verification"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] border border-amber-200 dark:border-amber-800 transition-colors"
                          >
                            <CheckSquare className="h-3 w-3" />
                            <span>Verify</span>
                          </Link>
                        ) : null}
                        <Link
                          href={`/admin/complaints/${item.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-all hover:scale-105"
                        >
                          <span>Manage</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
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
