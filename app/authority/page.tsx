"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  FileCheck2,
  Calendar,
  Building,
  MapPin,
  ExternalLink,
  Search,
  Filter,
  Loader2,
  Image as ImageIcon,
  Check,
  Send,
  User,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  HelpCircle,
  XCircle,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { CATEGORIES } from "@/lib/constants";
import { Complaint, Priority, ResolutionStatus } from "@/lib/types";
import { PriorityBadge, ResolutionBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { DEPARTMENT_OPTIONS, getCanonicalDepartment, getDepartmentDisplayName } from "@/lib/department-routing";
import { AI_CATEGORY_OPTIONS, getAIComplaintCategoryLabel } from "@/lib/ai/categories";

export default function AuthorityDashboardPage() {
  const {
    complaints,
    currentUser,
    updateStatus,
    resolveComplaintByAuthority,
  } = useCampusFix();

  const userDepartment = currentUser?.department;
  const canonicalUserDepartment = userDepartment ? getCanonicalDepartment(userDepartment) || userDepartment : undefined;
  const canViewAllDepartments = currentUser?.authorityScope === "all_departments";

  // Tab & Search filters
  const [activeTab, setActiveTab] = useState<"all" | "my_dept" | "in_progress" | "resolved">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Interaction modals
  const [selectedTask, setSelectedTask] = useState<Complaint | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);

  // Form states
  const [progressNote, setProgressNote] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionProofUrl, setResolutionProofUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // The API returns only database records authorized for this account.
  const authorityOrders = useMemo(() => {
    return complaints.filter((c) => {
      if (!c.assignedDepartment || !["awaiting_verification", "verified"].includes(c.verificationStatus)) return false;
      const canonicalComplaintDepartment = getCanonicalDepartment(c.assignedDepartment) || c.assignedDepartment;
      if (!canViewAllDepartments && canonicalComplaintDepartment !== canonicalUserDepartment) return false;
      if (departmentFilter !== "all" && canonicalComplaintDepartment !== departmentFilter) return false;

      // Tab filter
      if (activeTab === "my_dept") {
        if ((getCanonicalDepartment(c.assignedDepartment) || c.assignedDepartment) !== canonicalUserDepartment) return false;
      } else if (activeTab === "in_progress") {
        if (c.resolutionStatus !== "in_progress") return false;
      } else if (activeTab === "resolved") {
        if (c.resolutionStatus !== "resolved") return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && c.priority !== priorityFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.campusLocation.toLowerCase().includes(q) ||
          c.specificLocation.toLowerCase().includes(q) ||
          (c.assignedDepartment && c.assignedDepartment.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [complaints, activeTab, priorityFilter, searchQuery, canonicalUserDepartment, canViewAllDepartments, departmentFilter]);

  // Cards summarize all authorized department records; list filters do not alter them.
  const assignedComplaints = complaints.filter((c) =>
    Boolean(c.assignedDepartment) && ["awaiting_verification", "verified"].includes(c.verificationStatus) &&
    (canViewAllDepartments || (getCanonicalDepartment(c.assignedDepartment || "") || c.assignedDepartment) === canonicalUserDepartment)
  );
  const inProgressCount = assignedComplaints.filter((c) => c.resolutionStatus === "in_progress").length;
  const resolvedTotal = assignedComplaints.filter((c) => c.resolutionStatus === "resolved").length;
  const pendingVerificationCount = complaints.filter((c) => c.verificationStatus === "awaiting_verification").length;
  const awaitingWorkCount = complaints.filter((c) => c.verificationStatus === "verified" && c.resolutionStatus === "pending_assignment").length;
  const rejectedOrClarificationCount = complaints.filter((c) => c.verificationStatus === "rejected" || c.verificationStatus === "info_requested").length;
  const totalHighCriticalCount = complaints.filter((c) => c.resolutionStatus !== "resolved" && (c.priority === "critical" || c.priority === "high")).length;
  const categoryCounts = AI_CATEGORY_OPTIONS.map((category) => ({
    ...category,
    count: complaints.filter((complaint) => complaint.aiCategory === category.id).length,
  }));
  const departmentCounts = Array.from(new Set(complaints.map((complaint) => complaint.assignedDepartment).filter((department): department is string => Boolean(department))))
    .map((department) => ({ department, count: complaints.filter((complaint) => complaint.assignedDepartment === department).length }))
    .sort((a, b) => b.count - a.count);

  // Actions
  const handleStartTask = async (c: Complaint) => {
    setIsProcessing(true);
    try {
      await updateStatus(
        c.id,
        "in_progress",
        `Work started on-site by ${currentUser?.name || "Department Authority"}. Tools and materials mobilized.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenProgress = (c: Complaint) => {
    setSelectedTask(c);
    setProgressNote("");
    setProgressModalOpen(true);
  };

  const handleConfirmProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !progressNote.trim()) return;
    setIsProcessing(true);
    try {
      await updateStatus(selectedTask.id, "in_progress", progressNote.trim());
      setProgressModalOpen(false);
      setSelectedTask(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenResolve = (c: Complaint) => {
    setSelectedTask(c);
    setResolutionSummary(
      `Issue fully inspected, repaired, and operational testing verified on-site by ${currentUser?.name || "Lead Engineer"}.`
    );
    setResolutionProofUrl(
      c.evidenceUrl || "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80"
    );
    setResolveModalOpen(true);
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !resolutionSummary.trim()) return;
    setIsProcessing(true);
    try {
      await resolveComplaintByAuthority(
        selectedTask.id,
        resolutionSummary.trim(),
        resolutionProofUrl.trim() || undefined,
        "repair_certification_proof.jpg"
      );
      setResolveModalOpen(false);
      setSelectedTask(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (isoString: string) => {
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
      {/* Header Profile Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 border border-slate-800 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0 shadow-lg shadow-sky-500/10">
              <Wrench className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Campus Operations Authority
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active On-Duty
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Campus Operations Authority
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                <span>{canViewAllDepartments
                  ? "Review, coordinate, and resolve campus complaints across all departments."
                  : `Assigned department: ${getDepartmentDisplayName(userDepartment)}`}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-semibold transition-all",
                activeTab === "all"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/60"
              )}
            >
              Assigned Complaints
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard
          title="Total Complaints"
          count={complaints.length}
          icon={<Wrench className="h-5 w-5" />}
          subtitle={canViewAllDepartments ? "All departments" : "Your authorized scope"}
          colorScheme="sky"
        />
        <StatCard title="Pending Verification" count={pendingVerificationCount} icon={<Clock className="h-5 w-5" />} subtitle="Awaiting administrative review" colorScheme="amber" />
        <StatCard title="Approved / Awaiting Work" count={awaitingWorkCount} icon={<FileCheck2 className="h-5 w-5" />} subtitle="Verified for dispatch" colorScheme="indigo" />
        <StatCard
          title="In Progress"
          count={inProgressCount}
          icon={<PlayCircle className="h-5 w-5" />}
          subtitle="Technicians on-site"
          colorScheme="amber"
        />
        <StatCard
          title="High & Critical"
          count={totalHighCriticalCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          subtitle="Immediate attention required"
          colorScheme="rose"
        />
        <StatCard
          title="Resolved Complaints"
          count={resolvedTotal}
          icon={<CheckCircle2 className="h-5 w-5" />}
          subtitle="Fixed & confirmed closed"
          colorScheme="emerald"
        />
        <StatCard title="Rejected / Clarification" count={rejectedOrClarificationCount} icon={rejectedOrClarificationCount ? <HelpCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />} subtitle="Visible for operational context" colorScheme="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Complaints by AI Category</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categoryCounts.filter((item) => item.count > 0).map((item) => <div key={item.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950"><span>{getAIComplaintCategoryLabel(item.id)}</span><strong>{item.count}</strong></div>)}
            {!categoryCounts.some((item) => item.count > 0) && <p className="text-xs text-slate-500">Category totals will appear when classified complaints are available.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Complaints by Department</h2>
          <div className="mt-3 space-y-2">
            {departmentCounts.map((item) => <div key={item.department} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950"><span>{getDepartmentDisplayName(item.department)}</span><strong>{item.count}</strong></div>)}
            {!departmentCounts.length && <p className="text-xs text-slate-500">No department assignments in the authorized records.</p>}
          </div>
        </section>
      </div>

      {/* Work Orders List Header & Search Filter */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Department Work Orders</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                {authorityOrders.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Assigned campus complaints available for maintenance work and resolution.
            </p>
          </div>

          {/* Quick tab filters */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs font-semibold">
            {!canViewAllDepartments && <button
              onClick={() => setActiveTab("my_dept")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                activeTab === "my_dept"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              My Department
            </button>}
            <button
              onClick={() => setActiveTab("in_progress")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                activeTab === "in_progress"
                  ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              In Progress
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                activeTab === "resolved"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              Resolved
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                activeTab === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              All
            </button>
          </div>
        </div>

        {/* Search & Priority row */}
        <div className="flex flex-col xl:flex-row gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search work orders by ID, location, description, or title..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canViewAllDepartments && <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              aria-label="Filter by department"
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Departments</option>
              {DEPARTMENT_OPTIONS.map((department) => <option key={department.canonical} value={department.canonical}>{department.label}</option>)}
            </select>}
            <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" />
              Priority:
            </span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Cards Grid */}
      {authorityOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-sky-500 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            No Assigned Complaints Match These Filters
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            There are no assigned complaints matching the selected departments, status, priority, or search terms. New routed work orders will appear here automatically.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setDepartmentFilter("all");
              setPriorityFilter("all");
              setSearchQuery("");
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold dark:bg-slate-100 dark:text-slate-900"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {authorityOrders.map((order) => {
            const isResolved = order.resolutionStatus === "resolved";
            const isInProgress = order.resolutionStatus === "in_progress";
            const isPendingStart = order.resolutionStatus === "pending_assignment" || !isInProgress && !isResolved;

            return (
              <div
                key={order.id}
                className={cn(
                  "rounded-2xl border bg-white p-6 shadow-xs dark:bg-slate-900 space-y-4 transition-all hover:shadow-md",
                  isResolved
                    ? "border-emerald-200/80 dark:border-emerald-900/40"
                    : order.priority === "critical"
                    ? "border-rose-300 dark:border-rose-900/60"
                    : "border-slate-200/80 dark:border-slate-800"
                )}
              >
                {/* Top Row: IDs, Priority, Status, Department */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-900">
                      {order.id}
                    </span>
                    <PriorityBadge priority={order.priority} size="sm" />
                    <ResolutionBadge status={order.resolutionStatus} size="sm" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
                      {getDepartmentDisplayName(order.assignedDepartment)}
                    </span>
                    {order.assignedPerson && (
                      <span className="text-xs text-slate-500 font-medium">
                        Assignee: <strong>{order.assignedPerson}</strong>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Verified: {formatDate(order.verificationDate || order.updatedAt)}
                  </div>
                </div>

                {/* Middle Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Complaint Details */}
                  <div className="lg:col-span-2 space-y-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {order.title}
                    </h3>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {order.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-slate-400" />
                        <strong>Building:</strong> {order.campusLocation}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <strong>Room/Spot:</strong> {order.specificLocation}
                      </span>
                    </div>

                    {/* Admin Directives Notice */}
                    {order.verificationReason && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs">
                        <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">
                          Admin Forwarding Directives:
                        </span>
                        <p className="text-amber-800 dark:text-amber-200">
                          {order.verificationReason}
                        </p>
                      </div>
                    )}

                    {/* Department Authority Resolution Notes (if resolved) */}
                    {order.resolutionNotes && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs">
                        <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-0.5">
                          Resolution Certification by Department Authority:
                        </span>
                        <p className="text-emerald-800 dark:text-emerald-200">
                          {order.resolutionNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Student Info & Evidence Thumbnail */}
                  <div className="space-y-3 lg:border-l lg:border-slate-100 lg:dark:border-slate-800 lg:pl-6 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                        Reporting Student Contact
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {order.submittedBy.name}
                      </p>
                      <p className="text-slate-500">
                        Roll: {order.submittedBy.rollNumber || "23BCE1048"}
                      </p>
                      <p className="text-slate-500">{order.submittedBy.email}</p>
                    </div>

                    {order.evidenceUrl ? (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-sky-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                            {order.evidenceName || "Fault Evidence"}
                          </span>
                        </div>
                        <a
                          href={order.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                        >
                          View ↗
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        No photograph attached.
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Department Authority Task Execution Controls */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/authority/complaints/${order.id}`}
                    className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-semibold inline-flex items-center gap-1"
                  >
                    <span>Full Work Order History & Timeline</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action 1: Start Work Order if pending */}
                    {!isResolved && !isInProgress && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleStartTask(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>Start Work Order</span>
                      </button>
                    )}

                    {/* Action 2: Post Progress Update */}
                    {!isResolved && (
                      <button
                        type="button"
                        onClick={() => handleOpenProgress(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300 text-xs font-semibold transition-colors"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Post Work Update</span>
                      </button>
                    )}

                    {/* Action 3: Complete & Resolve */}
                    {!isResolved && (
                      <button
                        type="button"
                        onClick={() => handleOpenResolve(order)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Complete & Resolve</span>
                      </button>
                    )}

                    {isResolved && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        Task Resolved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Post Progress Update */}
      <Modal
        isOpen={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        title="Post Work Progress Update"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmProgress} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Log technician actions, parts requisitioned, or testing updates for{" "}
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {selectedTask?.id}
            </span>
            . This is audited on the student timeline.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Work Update Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="e.g. Technician arrived on-site. Replacement copper fittings and Teflon seals installed. Line pressure testing under evaluation..."
              className="w-full p-2.5 rounded-xl border border-sky-300 dark:border-sky-900 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setProgressModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Logging...</span>
                </>
              ) : (
                <span>Post Progress Log</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Complete & Resolve with Proof */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Complete Task & Mark Resolved"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmResolve} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
            <strong>Task Completion Certification:</strong> Marking this task resolved will inform the student and administrator that all repair work is completed.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Resolution Summary & Technical Fix Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              placeholder="e.g. Swapped out 25A MCB breaker, verified resistance load at 12 Ohms, and ensured geyser water temperature reaches 60°C without tripping..."
              className="w-full p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-900 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Resolution Photo Evidence URL / Proof Reference
            </label>
            <input
              type="url"
              value={resolutionProofUrl}
              onChange={(e) => setResolutionProofUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Photo proof of restored fixture or repair work for the student to inspect.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setResolveModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Certify & Mark Resolved</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
