import React from "react";
import Link from "next/link";
import { Lock, ArrowLeft, Shield } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-600/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-6">
        <Lock className="h-8 w-8" />
      </div>

      <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-900 mb-3">
        403 — Access Denied
      </span>

      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
        Restricted Institutional Area
      </h1>

      <p className="mt-3 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
        This section is reserved for verified CampusFix Administrators. Your current authenticated role does not have authorization to view or execute actions on this resource.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/student"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Student Dashboard</span>
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
        >
          <span>Switch Account</span>
        </Link>
      </div>
    </div>
  );
}
