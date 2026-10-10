"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Building,
  MapPin,
  Tag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  XCircle,
  HelpCircle,
  Wrench,
  UserCheck,
  Send,
  Loader2,
  FileText,
  Image as ImageIcon,
  Share2,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { VerticalTimeline } from "@/components/ui/timeline";
import { VerificationBadge, ResolutionBadge, PriorityBadge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export default function StudentComplaintDetailsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Loading complaint tracking details...
          </p>
        </div>
      }
    >
      <StudentComplaintDetailsContent />
    </React.Suspense>
  );
}

function StudentComplaintDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const complaintId = params?.id as string;

  const {
    getComplaintById,
    provideAdditionalInfo,
    confirmResolution,
    reopenComplaint,
  } = useCampusFix();

  const complaint = getComplaintById(complaintId);

  // State for providing additional info
  const [infoReply, setInfoReply] = useState("");
  const [isSubmittingInfo, setIsSubmittingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState(false);

  // State for confirm / reopen
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!complaint) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <FileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Complaint Record Not Found
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No record matches ticket ID &quot;{complaintId}&quot;. It may have been deleted or the ID is incorrect.
        </p>
        <Link
          href="/student/complaints"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
        >
          Return to My Complaints
        </Link>
      </div>
    );
  }

  const categoryMeta = CATEGORIES.find((c) => c.id === complaint.category);

  const handleSendAdditionalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoReply.trim()) return;

    setIsSubmittingInfo(true);
    try {
      await provideAdditionalInfo(complaint.id, infoReply.trim());
      setInfoSuccess(true);
      setInfoReply("");
    } catch {
      // Error
    } finally {
      setIsSubmittingInfo(false);
    }
  };

  const handleConfirmResolution = async () => {
    setIsConfirming(true);
    try {
      await confirmResolution(complaint.id);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;

    setIsReopening(true);
    try {
      await reopenComplaint(complaint.id, reopenReason.trim());
      setReopenModalOpen(false);
      setReopenReason("");
    } finally {
      setIsReopening(false);
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/student/complaints"
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

      {/* Info Requested Action Alert (if applicable) */}
      {complaint.verificationStatus === "info_requested" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6 dark:border-blue-900/60 dark:bg-blue-950/40 space-y-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                Action Required: Additional Information Requested
              </h4>
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                The Campus Administrator requested clarification before this complaint can be verified:
              </p>
              <div className="mt-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 text-xs font-medium text-slate-800 dark:text-slate-200">
                &ldquo;{complaint.additionalInfoRequested}&rdquo;
              </div>
            </div>
          </div>

          {infoSuccess ? (
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Information submitted! Complaint returned to administrative review queue.
            </div>
          ) : (
            <form onSubmit={handleSendAdditionalInfo} className="space-y-3 pt-1">
              <textarea
                required
                rows={3}
                value={infoReply}
                onChange={(e) => setInfoReply(e.target.value)}
                placeholder="Type your response here (e.g. It is geyser unit #1 near the west staircase)..."
                className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingInfo}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-70"
                >
                  {isSubmittingInfo ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Submit Additional Details</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Rejection Notice (if rejected) */}
      {complaint.verificationStatus === "rejected" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 dark:border-rose-900/60 dark:bg-rose-950/40 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-rose-900 dark:text-rose-200">
              Complaint Declined During Screening
            </h4>
            <p className="mt-1 text-rose-800 dark:text-rose-300">
              <strong>Official Reason:</strong> {complaint.verificationReason || "Declined during initial verification review."}
            </p>
          </div>
        </div>
      )}

      {/* Resolution Confirmation Action (if resolved) */}
      {complaint.resolutionStatus === "resolved" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold text-emerald-900 dark:text-emerald-200">
                Issue Marked as Resolved
              </h4>
              <p className="text-emerald-800 dark:text-emerald-300 mt-0.5">
                Technicians reported this issue fixed on {formatDate(complaint.resolvedAt)}. Please confirm if the resolution is satisfactory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirmResolution}
              disabled={isConfirming}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Confirm Resolved
            </button>
            <button
              type="button"
              onClick={() => setReopenModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold hover:bg-emerald-100/60 transition-colors"
            >
              Report Recurring Issue
            </button>
          </div>
        </div>
      )}

      {/* Two Column Layout: Left Details, Right Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Metadata & Evidence */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Details Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Complaint Specifications
            </h3>

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase">Description</h4>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {complaint.description}
              </p>
            </div>

            {/* Grid of Key Properties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Campus Location
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {complaint.campusLocation}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {complaint.specificLocation}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Category & Department
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {categoryMeta?.label || complaint.category}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Responsible: {complaint.assignedDepartment || categoryMeta?.department}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Assigned Personnel
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {complaint.assignedPerson || "Awaiting dispatch"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Submission Timestamp
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {formatDate(complaint.submittedAt)}
                </span>
              </div>
            </div>

            {/* Resolution Notes (if available) */}
            {complaint.resolutionNotes && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Department Resolution Log:
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {complaint.resolutionNotes}
                </p>
              </div>
            )}
          </div>

          {/* Attached Evidence Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Attached Evidence
            </h3>

            {complaint.evidenceUrl ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 max-h-80 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={complaint.evidenceUrl}
                    alt={complaint.evidenceName || "Complaint evidence"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono">{complaint.evidenceName || "evidence_photo.jpg"}</span>
                  <a
                    href={complaint.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    Open Full Image ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No visual evidence was attached with this submission.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Vertical Progress Timeline */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Progress Timeline
              </h3>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {complaint.timeline.length} Milestones
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

      {/* Reopen Modal */}
      <Modal
        isOpen={reopenModalOpen}
        onClose={() => setReopenModalOpen(false)}
        title="Reopen Complaint"
        maxWidth="md"
      >
        <form onSubmit={handleReopen} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            If the repair was incomplete or the problem has recurred, please explain the issue in detail. The complaint will be routed back to the department supervisor.
          </p>
          <textarea
            required
            rows={4}
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Explain why this issue is not resolved..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-600"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setReopenModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReopening}
              className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors"
            >
              {isReopening ? "Reopening..." : "Confirm Reopen"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
