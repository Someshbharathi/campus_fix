"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  GraduationCap,
  Building2,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  FileCheck2,
  Users,
  Sparkles,
  Lock,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";

export default function HomePage() {
  const router = useRouter();
  const { currentUser, switchRole, complaints } = useCampusFix();

  const totalComplaints = complaints.length;
  const awaitingVerification = complaints.filter(
    (c) => c.verificationStatus === "awaiting_verification"
  ).length;
  const inProgress = complaints.filter(
    (c) => c.resolutionStatus === "in_progress" || c.resolutionStatus === "pending_assignment"
  ).length;
  const resolved = complaints.filter((c) => c.resolutionStatus === "resolved").length;

  const handleStudentEntry = () => {
    switchRole("student");
    router.push("/student");
  };

  const handleAdminEntry = () => {
    switchRole("admin");
    router.push("/admin");
  };

  const handleAuthorityEntry = () => {
    switchRole("faculty");
    router.push("/authority");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Banner Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">CampusFix</span>
              <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Genesis &apos;26
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/help"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors hidden sm:block"
            >
              Public Guidelines
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Next-Generation Campus Grievance & Facility Tracking
          </div>

          <h1 className="text-4xl sm:6xl font-extrabold tracking-tight text-white leading-tight">
            Your Campus. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-300">Your Voice.</span>
          </h1>

          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Eliminating delayed, ignored, and duplicate campus complaints. Transparent progress tracking, verifiable ownership, and swift resolution across all campus departments.
          </p>

          {/* Role Portal Cards - 3 Modes */}
          <div className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto text-left">
            {/* Student Card */}
            <div
              onClick={handleStudentEntry}
              className="group cursor-pointer rounded-2xl bg-slate-900/80 border border-slate-800 p-6 hover:border-indigo-500/60 hover:bg-slate-900 transition-all hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Student Portal
                </h2>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Submit complaints with photo evidence, monitor verification milestones, and track real-time resolution on an interactive vertical timeline.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-indigo-400 group-hover:underline flex items-center gap-1.5">
                  Launch Student View
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                  Rohan Verma
                </span>
              </div>
            </div>

            {/* Administrator Card */}
            <div
              onClick={handleAdminEntry}
              className="group cursor-pointer rounded-2xl bg-slate-900/80 border border-slate-800 p-6 hover:border-amber-500/60 hover:bg-slate-900 transition-all hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Building2 className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Administrator Console
                </h2>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Screen & filter complaints: reject invalid tickets with transparent explanations or forward work orders directly to campus authorities.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-amber-400 group-hover:underline flex items-center gap-1.5">
                  Launch Admin Console
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                  Dr. Sundaram
                </span>
              </div>
            </div>

            {/* Authority Card */}
            <div
              onClick={handleAuthorityEntry}
              className="group cursor-pointer rounded-2xl bg-slate-900/80 border border-slate-800 p-6 hover:border-sky-500/60 hover:bg-slate-900 transition-all hover:shadow-xl hover:shadow-sky-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Wrench className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                  Authority Mode
                </h2>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Field execution workspace: view assigned tickets, execute repairs, publish progress updates, and upload resolution proof for students.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-sky-400 group-hover:underline flex items-center gap-1.5">
                  Launch Authority Portal
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                  Er. Rajesh Sharma
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-time Campus Metrics */}
      <section className="border-y border-slate-800 bg-slate-900/50 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">
            Live Institutional Metrics
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-3xl font-extrabold text-white block">
                {totalComplaints}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Total Recorded</span>
            </div>
            <div className="text-center p-4 rounded-xl bg-amber-950/20 border border-amber-900/50">
              <span className="text-3xl font-extrabold text-amber-400 block">
                {awaitingVerification}
              </span>
              <span className="text-xs text-amber-300/80 mt-1 block">Awaiting Verification</span>
            </div>
            <div className="text-center p-4 rounded-xl bg-sky-950/20 border border-sky-900/50">
              <span className="text-3xl font-extrabold text-sky-400 block">
                {inProgress}
              </span>
              <span className="text-xs text-sky-300/80 mt-1 block">Under Resolution</span>
            </div>
            <div className="text-center p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50">
              <span className="text-3xl font-extrabold text-emerald-400 block">
                {resolved}
              </span>
              <span className="text-xs text-emerald-300/80 mt-1 block">Verified & Resolved</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Principles Section */}
      <section className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h3 className="text-2xl font-bold text-white">
            Built on Institutional Transparency
          </h3>
          <p className="text-sm text-slate-400 mt-2">
            Every step is audited. No complaint is left in an untracked limbo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h4 className="text-base font-semibold text-white">
              Strict Complaint Verification
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Before complaints enter the work pipeline, administrators inspect veracity, prevent duplicate tickets, and ask for specific missing details.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-sky-600/20 text-sky-400 flex items-center justify-center mb-4">
              <Clock className="h-5 w-5" />
            </div>
            <h4 className="text-base font-semibold text-white">
              Step-by-Step Vertical Timeline
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Students and staff can audit exact timestamps: when the issue was reported, verified, assigned to technicians, and confirmed repaired.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-4">
              <Users className="h-5 w-5" />
            </div>
            <h4 className="text-base font-semibold text-white">
              Department Accountability
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Clear ownership across Electrical, Plumbing, IT, Sanitation, Hostels, and Security departments with designated personnel assignments.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 CampusFix — Genesis &apos;26 Hackathon. Member 1 Frontend Development.</p>
          <div className="flex items-center gap-4">
            <Link href="/help" className="hover:text-slate-300">
              Grievance Guidelines
            </Link>
            <Link href="/login" className="hover:text-slate-300">
              Staff & Student Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
