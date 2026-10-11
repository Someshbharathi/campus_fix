"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building,
  MapPin,
  Calendar,
  Wrench,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  Send,
  User,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { CATEGORIES } from "@/lib/constants";
import { PriorityBadge, ResolutionBadge, VerificationBadge } from "@/components/ui/badge";
import { VerticalTimeline } from "@/components/ui/timeline";
import { cn } from "@/lib/utils";

export default function AuthorityComplaintDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-600 mb-3" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Loading Department Authority work order...
          </p>
        </div>
      }
    >
      <AuthorityComplaintDetailContent />
    </React.Suspense>
  );
}

function AuthorityComplaintDetailContent() {
  const params = useParams();
  const router = useRouter();
  const complaintId = params?.id as string;

  const {
    getComplaintById,
    currentUser,
    updateStatus,
    resolveComplaintByAuthority,
  } = useCampusFix();

  const complaint = getComplaintById(complaintId);

  // Execution states
  const [progressLog, setProgressLog] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState(complaint?.resolutionNotes || "");
  const [resolutionProofUrl, setResolutionProofUrl] = useState(
    complaint?.resolutionProofUrl || complaint?.evidenceUrl || ""
  );
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!complaint) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <FileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Work Order Record Not Found
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No work order matches ticket ID &quot;{complaintId}&quot;.
        </p>
        <Link
          href="/authority"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          Return to Department Authority Dashboard
        </Link>
      </div>
    );
  }

  const categoryMeta = CATEGORIES.find((c) => c.id === complaint.category);
  const isResolved = complaint.resolutionStatus === "resolved";

  const handleStartWork = async () => {
    setIsUpdatingProgress(true);
    try {
      await updateStatus(
        complaint.id,
        "in_progress",
        `Work order commenced on-site by ${currentUser?.name || "Field Officer"} (${currentUser?.department || "Maintenance"}).`
      );
      setActionSuccess("Task transitioned to In-Progress status.");
      setTimeout(() => setActionSuccess(null), 3000);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handlePostProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressLog.trim()) return;

    setIsUpdatingProgress(true);
    try {
      await updateStatus(complaint.id, "in_progress", progressLog.trim());
      setProgressLog("");
      setActionSuccess("Progress log recorded in timeline.");
      setTimeout(() => setActionSuccess(null), 3000);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handleCertifyResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) return;

    setIsResolving(true);
    try {
      await resolveComplaintByAuthority(
        complaint.id,
        resolutionNotes.trim(),
        resolutionProofUrl.trim() || undefined,
        "authority_resolution_certification.jpg"
      );
      setActionSuccess("Work order marked as Resolved! Student has been notified.");
      setTimeout(() => setActionSuccess(null), 3000);
    } finally {
      setIsResolving(false);
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
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/authority"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-0.5 rounded-md border border-sky-200 dark:border-sky-900">
                {complaint.id}
              </span>
              <PriorityBadge priority={complaint.priority} size="sm" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {complaint.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <VerificationBadge status={complaint.verificationStatus} />
          <ResolutionBadge status={complaint.resolutionStatus} />
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Grid: Details & Execution Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Complaint Data & Admin Directives */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work Order Overview Box */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Work Order Specifications
            </h2>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block">
                Student&apos;s Problem Statement
              </span>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {complaint.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Campus Location
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {complaint.campusLocation}
                </p>
                <p className="text-slate-500">Room / Spot: {complaint.specificLocation}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Dispatched Department
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {complaint.assignedDepartment || "General Works"}
                </p>
                <p className="text-slate-500">
                  Assigned Lead: {complaint.assignedPerson || currentUser?.name}
                </p>
              </div>
            </div>

            {/* Admin Forwarding Directives */}
            {complaint.verificationReason && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-300 block">
                  Administrator Dispatch Directives
                </span>
                <p className="text-amber-800 dark:text-amber-200">
                  {complaint.verificationReason}
                </p>
              </div>
            )}

            {/* Photo Evidence Preview */}
            {complaint.evidenceUrl && (
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Report Evidence Attached by Student
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-sky-500" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {complaint.evidenceName || "Photo Attachment"}
                    </span>
                  </div>
                  <a
                    href={complaint.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Open Full Size ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Department Authority Execution Controls */}
          <div className="rounded-2xl border border-sky-200/80 bg-white p-6 dark:border-sky-950 dark:bg-slate-900 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-sky-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Department Authority Task Execution Console
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 capitalize">
                Status: {complaint.resolutionStatus.replace("_", " ")}
              </span>
            </div>

            {/* Quick Kickoff if pending */}
            {complaint.resolutionStatus !== "in_progress" && !isResolved && (
              <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-sky-900 dark:text-sky-200 block">
                    Kick off Physical On-Site Work
                  </span>
                  <p className="text-sky-700 dark:text-sky-300 mt-0.5">
                    Transition ticket status to In-Progress and notify the student and administration.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isUpdatingProgress}
                  onClick={handleStartWork}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm shadow-sky-600/30"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span>Start Work Order</span>
                </button>
              </div>
            )}

            {/* 1. Post On-site Progress Update */}
            {!isResolved && (
              <form onSubmit={handlePostProgress} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Log On-Site Technical Progress Update
                  </label>
                  <textarea
                    rows={3}
                    value={progressLog}
                    onChange={(e) => setProgressLog(e.target.value)}
                    placeholder="e.g. Electrician Mohan on site. Replaced burnt capacitor, currently load testing..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdatingProgress || !progressLog.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isUpdatingProgress ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Post Progress Entry</span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. Complete & Certify Resolution */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {isResolved ? "Resolution Certified" : "Final Resolution Certification"}
              </h3>

              {isResolved ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-2">
                  <p className="font-bold text-emerald-900 dark:text-emerald-200">
                    Officially Resolved by Department Authority on {formatDate(complaint.resolvedAt)}
                  </p>
                  <p className="text-emerald-800 dark:text-emerald-300">
                    {complaint.resolutionNotes}
                  </p>
                  {complaint.resolutionProofUrl && (
                    <a
                      href={complaint.resolutionProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline mt-1"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      View Resolution Proof ↗
                    </a>
                  )}
                </div>
              ) : (
                <form onSubmit={handleCertifyResolution} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Technical Resolution Summary <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Specify the replacement parts, electrical testing results, or fix actions performed..."
                      className="w-full p-3 rounded-xl border border-emerald-300 dark:border-emerald-900 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Resolution Evidence Photo URL
                    </label>
                    <input
                      type="url"
                      value={resolutionProofUrl}
                      onChange={(e) => setResolutionProofUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isResolving}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-600/30"
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Certifying...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Certify Fix & Mark Resolved</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Student Info & Audited Timeline */}
        <div className="space-y-6">
          {/* Student Profile Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Reporting Student Information
            </span>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm shrink-0">
                {complaint.submittedBy.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {complaint.submittedBy.name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {complaint.submittedBy.email}
                </p>
                <p className="text-[11px] text-slate-400">
                  Roll: {complaint.submittedBy.rollNumber || "23BCE1048"}
                </p>
              </div>
            </div>
          </div>

          {/* Full Audited Timeline */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Audited Work Order Timeline
            </h3>

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
