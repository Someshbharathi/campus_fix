"use client";

import React from "react";
import Link from "next/link";
import {
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  ArrowLeft,
  ChevronRight,
  BookOpen,
  FileCheck2,
} from "lucide-react";
import { VERIFICATION_STATUS_META, RESOLUTION_STATUS_META } from "@/lib/constants";
import { VerificationStatus, ResolutionStatus } from "@/lib/types";

export default function HelpPage() {
  const verificationKeys: VerificationStatus[] = [
    "awaiting_verification",
    "verified",
    "info_requested",
    "rejected",
  ];

  const resolutionKeys: ResolutionStatus[] = [
    "submitted",
    "awaiting_verification",
    "pending_assignment",
    "in_progress",
    "resolved",
    "reopened",
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 text-slate-900 dark:text-slate-100">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-1">
                <BookOpen className="h-3 w-3" />
                Knowledge Base & FAQ
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                CampusFix Help Center & Guidelines
              </h1>
            </div>
          </div>

          <Link
            href="/student/submit"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            Submit Complaint
          </Link>
        </div>

        {/* Operational Modes Overview */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">
              CampusFix Three-Tier Operational Modes
            </h2>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            CampusFix enforces clear separation of concerns across three dedicated campus roles to ensure accountability, rapid filtering, and quality resolution:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 text-xs space-y-1.5">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 block text-sm">
                1. Student Mode
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Logs grievances with photograph proof and exact campus coordinates. Tracks audit milestones and confirms satisfactory repairs upon resolution.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 text-xs space-y-1.5">
              <span className="font-bold text-amber-900 dark:text-amber-300 block text-sm">
                2. Administrator Mode
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Screens & filters grievances. Declines invalid tickets with transparent explanations, or forwards verified work orders directly to designated field authorities.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-sky-200/80 dark:border-sky-900/40 bg-sky-50/30 dark:bg-sky-950/20 text-xs space-y-1.5">
              <span className="font-bold text-sky-900 dark:text-sky-300 block text-sm">
                3. Department Authority Mode
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Carries out technical repairs and on-site tasks. Logs real-time progress entries and uploads resolution proof images upon work completion.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Complaint Verification Explained */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">
              Why does CampusFix require Complaint Verification?
            </h2>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            In standard campus environments, complaint queues get clogged with duplicate submissions, vague reports (e.g. &ldquo;light broken&rdquo; without room numbers), or non-infrastructure issues.
          </p>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            CampusFix enforces an explicit <strong>Verification Phase</strong> before tickets enter active resolution:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                1. Veracity Check
              </span>
              <p className="text-slate-500">
                Staff verify the report is physically accurate on campus and not spam.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                2. De-duplication
              </span>
              <p className="text-slate-500">
                Avoids dispatching multiple electrician teams to the same room or hostel floor.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                3. Direct Dispatch
              </span>
              <p className="text-slate-500">
                Once verified, work orders are dispatched with clear priority and SLA expectations.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Status Dictionary */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-6">
          <h2 className="text-lg font-bold">Complaint Lifecycle & Status Dictionary</h2>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              A. Verification Statuses
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {verificationKeys.map((k) => {
                const meta = VERIFICATION_STATUS_META[k];
                return (
                  <div
                    key={k}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                  >
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {meta.label}
                    </span>
                    <p className="mt-1 text-slate-500">{meta.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              B. Resolution Statuses
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resolutionKeys.map((k) => {
                const meta = RESOLUTION_STATUS_META[k];
                return (
                  <div
                    key={k}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                  >
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {meta.label}
                    </span>
                    <p className="mt-1 text-slate-500">{meta.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Emergency Contacts Directory */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Phone className="h-5 w-5 text-indigo-600" />
            Campus Emergency & Maintenance Directory
          </h2>
          <p className="text-xs text-slate-500">
            For life-safety emergencies, power fires, or flooding, call the emergency control room immediately in addition to logging a ticket:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Campus Security Main Gate
              </span>
              <p className="text-slate-500 mt-0.5">Ext: 100 / +91 (080) 4123-1100</p>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Electrical Substation Duty Desk
              </span>
              <p className="text-slate-500 mt-0.5">Ext: 201 / +91 (080) 4123-1201</p>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Hostel Chief Warden Office
              </span>
              <p className="text-slate-500 mt-0.5">Ext: 310 / +91 (080) 4123-1310</p>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Campus Health Center / Ambulance
              </span>
              <p className="text-slate-500 mt-0.5">Ext: 108 / +91 (080) 4123-1108</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
