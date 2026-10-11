"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  AlertTriangle,
  FileText,
  MapPin,
  Building,
  User,
  Calendar,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Wrench,
  Send,
  Sparkles,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { CATEGORIES, DEPARTMENTS } from "@/lib/constants";
import { Complaint, Priority } from "@/lib/types";
import { PriorityBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export default function AdminVerificationQueuePage() {
  const { complaints, verifyComplaint, forwardComplaint, requestAdditionalInfo } =
    useCampusFix();

  // Filter queue for complaints awaiting verification or info requested
  const queue = complaints.filter(
    (c) =>
      c.verificationStatus === "awaiting_verification" ||
      c.verificationStatus === "info_requested"
  );

  // Active dialog states
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Form input states
  const [forwardDepartment, setForwardDepartment] = useState(DEPARTMENTS[0]);
  const [forwardPerson, setForwardPerson] = useState("");
  const [forwardPriority, setForwardPriority] = useState<Priority>("medium");
  const [forwardDirectives, setForwardDirectives] = useState("");

  const [rejectReason, setRejectReason] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleOpenForward = (c: Complaint) => {
    setSelectedComplaint(c);
    const cat = CATEGORIES.find((cat) => cat.id === c.category);
    setForwardDepartment(cat?.department || DEPARTMENTS[0]);
    setForwardPerson(
      cat?.department === "Electrical Maintenance"
        ? "Er. Rajesh Sharma (Lead)"
        : cat?.department === "Plumbing & Water Works"
        ? "Mohan Kumar (Senior Plumber)"
        : "Field Operations Unit"
    );
    setForwardPriority(c.priority || "medium");
    setForwardDirectives(
      "Report verified on site. Forwarded to the Department Authority for execution and resolution."
    );
    setForwardModalOpen(true);
  };

  const handleOpenReject = (c: Complaint) => {
    setSelectedComplaint(c);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleOpenInfo = (c: Complaint) => {
    setSelectedComplaint(c);
    setInfoMessage("");
    setInfoModalOpen(true);
  };

  const handleConfirmForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setIsProcessing(true);
    try {
      await forwardComplaint(
        selectedComplaint.id,
        forwardDepartment,
        forwardPerson.trim(),
        forwardPriority,
        forwardDirectives.trim()
      );
      setForwardModalOpen(false);
      setSelectedComplaint(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await verifyComplaint(selectedComplaint.id, false, rejectReason.trim());
      setRejectModalOpen(false);
      setSelectedComplaint(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRequestInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !infoMessage.trim()) return;
    setIsProcessing(true);
    try {
      await requestAdditionalInfo(selectedComplaint.id, infoMessage.trim());
      setInfoModalOpen(false);
      setSelectedComplaint(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const setRejectionTemplate = (explanation: string) => {
    setRejectReason(explanation);
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-1">
            <Clock className="h-3.5 w-3.5" />
            Active Verification Queue
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Complaint Verification & Screening
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Screen student grievances to confirm legitimacy, prevent duplicates, and request missing location or photo details before dispatching work orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {queue.length} Pending Inspection
          </span>
        </div>
      </div>

      {/* Verification Queue Cards */}
      {queue.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Verification Queue Clean!
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            All submitted campus grievances have been screened, verified, or processed. New submissions from students will appear here automatically.
          </p>
          <Link
            href="/admin"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold dark:bg-slate-100 dark:text-slate-900"
          >
            Return to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 p-6 space-y-4 hover:border-amber-300 dark:hover:border-amber-900/60 transition-all"
            >
              {/* Top Row: IDs, Priority, Submitted Date */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-900">
                    {item.id}
                  </span>
                  <PriorityBadge priority={item.priority} size="sm" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {CATEGORIES.find((c) => c.id === item.category)?.label}
                  </span>
                  {item.verificationStatus === "info_requested" && (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md dark:bg-blue-950 dark:text-blue-300">
                      Awaiting Student Reply
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Submitted: {formatDate(item.submittedAt)}
                </div>
              </div>

              {/* Middle Row: Content & Student info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      <strong>Building:</strong> {item.campusLocation}
                    </span>
                    <span>•</span>
                    <span>
                      <strong>Specific Room:</strong> {item.specificLocation}
                    </span>
                  </div>

                  {item.additionalInfoRequested && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs">
                      <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">
                        Clarification Requested to Student:
                      </span>
                      <p className="text-blue-800 dark:text-blue-200">
                        {item.additionalInfoRequested}
                      </p>
                    </div>
                  )}

                  {item.additionalInfoProvided && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs">
                      <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-0.5">
                        Student Response Received:
                      </span>
                      <p className="text-emerald-800 dark:text-emerald-200">
                        {item.additionalInfoProvided}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right side: Student Details & Evidence preview */}
                <div className="space-y-3 lg:border-l lg:border-slate-100 lg:dark:border-slate-800 lg:pl-6 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                      Reporting Student
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.submittedBy.name}
                    </p>
                    <p className="text-slate-500">
                      Roll: {item.submittedBy.rollNumber || "23BCE1048"}
                    </p>
                    <p className="text-slate-500">{item.submittedBy.email}</p>
                    {item.submittedBy.phone && (
                      <p className="text-slate-500">{item.submittedBy.phone}</p>
                    )}
                  </div>

                  {item.evidenceUrl ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-indigo-500" />
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                          {item.evidenceName || "Attachment"}
                        </span>
                      </div>
                      <a
                        href={item.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        Inspect ↗
                      </a>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      No photographic attachment provided.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions Row: Verification Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/admin/complaints/${item.id}`}
                  className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-semibold inline-flex items-center gap-1"
                >
                  <span>Open Full Ticket History</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenInfo(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-semibold transition-colors"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Request Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenReject(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-semibold transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Decline / Reject</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenForward(item)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Forward to Department Authority</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Forward to Department Authority Modal */}
      <Modal
        isOpen={forwardModalOpen}
        onClose={() => setForwardModalOpen(false)}
        title="Forward Complaint to Department Authority"
        maxWidth="lg"
      >
        <form onSubmit={handleConfirmForward} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-xs">
            <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200 mb-1">
              <span>Ticket: {selectedComplaint?.id}</span>
              <PriorityBadge priority={selectedComplaint?.priority || "medium"} size="sm" />
            </div>
            <p className="text-indigo-800 dark:text-indigo-300 font-medium">
              {selectedComplaint?.title}
            </p>
            <p className="text-indigo-600 dark:text-indigo-400 text-[11px] mt-1">
              Location: {selectedComplaint?.campusLocation} • {selectedComplaint?.specificLocation}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Dispatch Department <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={forwardDepartment}
                onChange={(e) => setForwardDepartment(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designated Officer / Lead Technician
              </label>
              <input
                type="text"
                value={forwardPerson}
                onChange={(e) => setForwardPerson(e.target.value)}
                placeholder="e.g. Er. Rajesh Sharma, Mohan Kumar"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Urgency Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForwardPriority(p)}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-xs font-semibold capitalize border transition-all text-center",
                    forwardPriority === p
                      ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                      : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Administrative Directives & Execution Instructions
            </label>
            <textarea
              rows={3}
              value={forwardDirectives}
              onChange={(e) => setForwardDirectives(e.target.value)}
              placeholder="e.g. Please inspect the main distributor box and replace damaged wiring before evening lab classes..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setForwardModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-600/30"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Forwarding...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Forward Work Order to Department Authority</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal with Mandatory Proper Explanation */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Decline Complaint with Official Explanation"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
              Transparent Institutional Policy
            </p>
            <p className="text-[11px] leading-relaxed">
              Every declined ticket requires a clear, respectful explanation. The student will receive this justification in their status timeline and notification alerts.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Quick Explanation Presets:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setRejectionTemplate(
                    "Duplicate of an existing active maintenance ticket. The issue is already queued under prior work order."
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() =>
                  setRejectionTemplate(
                    "The issue does not fall within campus facilities and estate mandate. Please consult your respective department office or student council."
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
              >
                Out of Scope
              </button>
              <button
                type="button"
                onClick={() =>
                  setRejectionTemplate(
                    "Insufficient location coordinates or lack of photographic proof prevents site inspection. Please submit a new ticket with specific room details."
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
              >
                Insufficient Details
              </button>
              <button
                type="button"
                onClick={() =>
                  setRejectionTemplate(
                    "Item is already scheduled for replacement during this week's comprehensive campus contractor cycle."
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
              >
                Scheduled Maintenance
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Official Explanation <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a clear, actionable explanation so the student understands why this ticket cannot proceed..."
              className="w-full p-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-600/30"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Declining...</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject Ticket & Send Explanation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Request Info Modal */}
      <Modal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="Request Additional Details from Student"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmRequestInfo} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Specify what details or photographs are missing to help verify and solve this issue:
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Message to Student <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
              placeholder="e.g. Please specify the room number, or whether the circuit breaker in the corridor is tripped..."
              className="w-full p-2.5 rounded-xl border border-blue-300 dark:border-blue-900 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInfoModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Requesting...</span>
                </>
              ) : (
                <span>Send Request</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
