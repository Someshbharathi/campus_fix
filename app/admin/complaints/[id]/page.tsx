"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building,
  User,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  XCircle,
  FileText,
  UserCheck,
  Send,
  Loader2,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { DEPARTMENTS } from "@/lib/constants";
import { AI_CATEGORY_OPTIONS, AIComplaintCategory, getAIComplaintCategoryLabel } from "@/lib/ai/categories";
import { Priority, ResolutionStatus } from "@/lib/types";
import { VerticalTimeline } from "@/components/ui/timeline";
import { VerificationBadge, ResolutionBadge, PriorityBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AdminComplaintManagementPage() {
  return (
    <React.Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-600 mb-3" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Loading complaint management details...
          </p>
        </div>
      }
    >
      <AdminComplaintManagementContent />
    </React.Suspense>
  );
}

function AdminComplaintManagementContent() {
  const params = useParams();
  const router = useRouter();
  const complaintId = params?.id as string;

  const {
    getComplaintById,
    currentUser,
    assignDepartment,
    updatePriority,
    updateStatus,
    updateAIComplaintCategory,
  } = useCampusFix();

  const complaint = getComplaintById(complaintId);

  // Management Form states
  const [department, setDepartment] = useState(
    complaint?.assignedDepartment || DEPARTMENTS[0]
  );
  const [assignedPerson, setAssignedPerson] = useState(
    complaint?.assignedPerson || ""
  );
  const [priority, setPriority] = useState<Priority>(
    complaint?.priority || "medium"
  );
  const [status, setStatus] = useState<ResolutionStatus>(
    complaint?.resolutionStatus || "in_progress"
  );
  const [progressNotes, setProgressNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [reviewCategory, setReviewCategory] = useState<AIComplaintCategory | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState("");

  if (!complaint) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <FileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Complaint Record Not Found
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No record matches ticket ID &quot;{complaintId}&quot;.
        </p>
        <Link
          href="/admin"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          Return to Admin Dashboard
        </Link>
      </div>
    );
  }

  const handleSaveManagement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Assign department/person if changed
      if (
        department !== complaint.assignedDepartment ||
        assignedPerson !== complaint.assignedPerson
      ) {
        await assignDepartment(complaint.id, department, assignedPerson);
      }

      // 2. Update priority if changed
      if (priority !== complaint.priority) {
        await updatePriority(complaint.id, priority);
      }

      // 3. Update status or add progress notes
      if (status !== complaint.resolutionStatus || progressNotes.trim()) {
        await updateStatus(complaint.id, status, progressNotes.trim() || undefined);
        setProgressNotes("");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

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

  const selectedCategory = reviewCategory ?? complaint.aiCategory ?? "other";

  const saveCategoryReview = async () => {
    setCategorySaving(true);
    setCategoryMessage("");
    try {
      await updateAIComplaintCategory(complaint.id, selectedCategory);
      setReviewCategory(selectedCategory);
      setCategoryMessage("AI category correction saved.");
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "Could not save category correction.");
    } finally {
      setCategorySaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900">
                {complaint.id}
              </span>
              <PriorityBadge priority={complaint.priority} size="sm" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {complaint.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <VerificationBadge status={complaint.verificationStatus} />
          <ResolutionBadge status={complaint.resolutionStatus} />
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4" />
          Changes successfully saved and recorded in the audit timeline!
        </div>
      )}

      {/* Grid: Left Management Form & Details, Right Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Department Assignment Form + Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Management Control Card */}
          <form
            onSubmit={handleSaveManagement}
            className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-indigo-600" />
                Work Order & Department Dispatch
              </h3>
              <span className="text-[11px] text-slate-400">
                Administrative Control Panel
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Assigned Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Responsible Person / Technician */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Responsible Technician / Staff
                </label>
                <input
                  type="text"
                  value={assignedPerson}
                  onChange={(e) => setAssignedPerson(e.target.value)}
                  placeholder="e.g. Mohan Kumar (Senior Plumber)"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Priority Rating
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="low">Low — Routine Maintenance</option>
                  <option value="medium">Medium — Standard Priority</option>
                  <option value="high">High — Urgent Attention</option>
                  <option value="critical">Critical — Immediate Emergency</option>
                </select>
              </div>

              {/* Resolution Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Resolution Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ResolutionStatus)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="pending_assignment">Pending Assignment</option>
                  <option value="in_progress">Work In Progress</option>
                  <option value="resolved">Mark as Resolved</option>
                  <option value="rejected">Mark as Rejected</option>
                </select>
              </div>
            </div>

            {/* Progress Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Progress Note / Resolution Audit Description
              </label>
              <textarea
                rows={3}
                value={progressNotes}
                onChange={(e) => setProgressNotes(e.target.value)}
                placeholder="Log technician action, replacement parts ordered, or work completed..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Updates...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Update Complaint Record</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Student Information & Complaint Context */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Student Grievance Details
            </h3>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {complaint.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Reporting Student
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {complaint.submittedBy.name} ({complaint.submittedBy.rollNumber || "23BCE1048"})
                </p>
                <p className="text-slate-500">{complaint.submittedBy.email}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Location Verified
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {complaint.campusLocation}
                </p>
                <p className="text-slate-500">{complaint.specificLocation}</p>
              </div>
            </div>

            {complaint.evidenceUrl && (
              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                  Evidence Attachment
                </span>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 max-h-64 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={complaint.evidenceUrl}
                    alt={complaint.evidenceName || "Evidence"}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">AI Classification & Assessment</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {(["Safety", "Severity", "Urgency", "Frequency"] as const).map((label, index) => {
                const values = [complaint.aiSafety, complaint.aiSeverity, complaint.aiUrgency, complaint.aiFrequency];
                return <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3"><span className="block text-slate-500">{label}</span><strong>{values[index] ?? "—"}{values[index] != null ? "/5" : ""}</strong></div>;
              })}
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3"><span className="block text-slate-500">Affected population</span><strong>{complaint.aiAffectedPopulation ?? "—"}{complaint.aiAffectedPopulation != null ? "/5" : ""}</strong></div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3"><span className="block text-slate-500">Priority score</span><strong>{complaint.priorityScore ?? "—"}</strong></div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-56 text-xs font-semibold text-slate-600">Review category: <span className="font-normal">{getAIComplaintCategoryLabel(complaint.aiCategory)}</span>
                <select value={selectedCategory} onChange={(e) => setReviewCategory(e.target.value as AIComplaintCategory)} disabled={currentUser?.role !== "admin"} className="mt-1 block w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs dark:border-slate-700 dark:bg-slate-950">
                  {AI_CATEGORY_OPTIONS.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </label>
              {currentUser?.role === "admin" && <button type="button" disabled={categorySaving || selectedCategory === complaint.aiCategory} onClick={saveCategoryReview} className="h-10 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{categorySaving ? "Saving…" : "Save correction"}</button>}
              {categoryMessage && <p role="status" className="w-full text-xs text-slate-500">{categoryMessage}</p>}
            </div>
            {complaint.aiSpam && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Flagged for review: {complaint.aiSpamReason || "Contextual spam assessment"}</p>}
            <div>
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">Potentially similar complaints ({complaint.similarComplaints?.length ?? 0})</h4>
              {complaint.similarComplaints?.length ? <ul className="mt-2 space-y-2">{complaint.similarComplaints.map((match) => <li key={match.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-xs dark:border-slate-800"><Link href={`/admin/complaints/${match.id}`} className="font-mono text-indigo-600 hover:underline">{match.id}</Link><span>{getAIComplaintCategoryLabel(match.category)} · {match.sameCategory ? "same category" : "cross category"}</span><strong>{Math.round(match.similarity * 100)}% similar</strong></li>)}</ul> : <p className="mt-1 text-xs text-slate-500">No similarity matches stored.</p>}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Vertical Progress Timeline */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Audit Timeline Log
              </h3>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {complaint.timeline.length} Events
              </span>
            </div>

            <VerticalTimeline
              events={complaint.timeline}
              verificationStatus={complaint.verificationStatus}
              resolutionStatus={complaint.resolutionStatus}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
