"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Wrench,
  Search,
  Filter,
  PlayCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Building,
  MapPin,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { DEPARTMENTS } from "@/lib/constants";
import { Complaint, Priority } from "@/lib/types";
import { PriorityBadge, ResolutionBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export default function AuthorityTasksPage() {
  const { complaints, currentUser, updateStatus, resolveComplaintByAuthority } =
    useCampusFix();

  const userDepartment = currentUser?.department || "Electrical Maintenance";

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [selectedTask, setSelectedTask] = useState<Complaint | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [progressNote, setProgressNote] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionProofUrl, setResolutionProofUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter tasks that are actively in progress or pending assignment/start
  const activeTasks = useMemo(() => {
    return complaints.filter((c) => {
      if (c.verificationStatus !== "verified") return false;
      if (c.resolutionStatus === "resolved" || c.resolutionStatus === "rejected") {
        return false;
      }

      if (departmentFilter !== "all" && c.assignedDepartment !== departmentFilter) {
        return false;
      }

      if (priorityFilter !== "all" && c.priority !== priorityFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.campusLocation.toLowerCase().includes(q) ||
          c.specificLocation.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [complaints, departmentFilter, priorityFilter, searchQuery]);

  const handleStart = async (c: Complaint) => {
    setIsProcessing(true);
    try {
      await updateStatus(
        c.id,
        "in_progress",
        `Work started on-site by ${currentUser?.name || "Technician"}.`
      );
    } finally {
      setIsProcessing(false);
    }
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

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !resolutionSummary.trim()) return;
    setIsProcessing(true);
    try {
      await resolveComplaintByAuthority(
        selectedTask.id,
        resolutionSummary.trim(),
        resolutionProofUrl.trim() || undefined
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold mb-1">
            <Wrench className="h-3.5 w-3.5" />
            Active Field Work Orders
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Active Department Authority Tasks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pending kick-off and ongoing maintenance tasks across campus facilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            {activeTasks.length} Active Tasks
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search active tasks by ID, building, or description..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

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

      {/* Task List */}
      {activeTasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-sky-500 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            No Active Tasks Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            There are no ongoing or pending work orders matching your search filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-sky-300 dark:hover:border-sky-900/60 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-900">
                    {task.id}
                  </span>
                  <PriorityBadge priority={task.priority} size="sm" />
                  <ResolutionBadge status={task.resolutionStatus} size="sm" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {task.assignedDepartment || "General Works"}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Logged: {formatDate(task.submittedAt)}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {task.title}
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                  {task.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    {task.campusLocation}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {task.specificLocation}
                  </span>
                </div>
              </div>

              {task.verificationReason && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs">
                  <strong className="text-amber-900 dark:text-amber-300 block mb-0.5">
                    Admin Dispatch Note:
                  </strong>
                  <p className="text-amber-800 dark:text-amber-200">
                    {task.verificationReason}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/authority/complaints/${task.id}`}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <span>Open Full Work Order Console</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>

                <div className="flex items-center gap-2">
                  {task.resolutionStatus !== "in_progress" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleStart(task)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>Start Task</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTask(task);
                      setProgressNote("");
                      setProgressModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Post Update</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTask(task);
                      setResolutionSummary("Repairs completed and site cleared.");
                      setResolutionProofUrl(task.evidenceUrl || "");
                      setResolveModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Complete & Resolve</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress Modal */}
      <Modal
        isOpen={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        title="Post Work Progress Update"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmProgress} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Log technician actions for ticket{" "}
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {selectedTask?.id}
            </span>
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Progress Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="e.g. Swapped capacitor, tested power lines..."
              className="w-full p-2.5 rounded-xl border border-sky-300 dark:border-sky-900 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setProgressModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700"
            >
              Post Update
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Mark Task Resolved"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmResolve} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Resolution Summary <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              placeholder="Summary of repair actions taken..."
              className="w-full p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Proof Attachment URL
            </label>
            <input
              type="url"
              value={resolutionProofUrl}
              onChange={(e) => setResolutionProofUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setResolveModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
            >
              Mark Resolved
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
