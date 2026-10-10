import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-6">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-900 mb-3">
        404 — Page Not Found
      </span>

      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
        Lost in Campus?
      </h1>

      <p className="mt-3 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
        The route or complaint resource you requested does not exist or has been relocated.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-colors"
        >
          <Home className="h-4 w-4" />
          <span>CampusFix Home</span>
        </Link>
        <Link
          href="/student"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
        >
          <span>Student Portal</span>
        </Link>
      </div>
    </div>
  );
}
