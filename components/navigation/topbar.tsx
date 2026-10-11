"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  PlusCircle,
  CheckSquare,
  Wrench,
  Shield,
  GraduationCap,
  LogOut,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { getRoleHomePath, isAuthorityRole, useCampusFix } from "@/lib/store";

interface TopbarProps {
  onOpenMobileSidebar: () => void;
  onOpenNotifications: () => void;
  title?: string;
  subtitle?: string;
}

export function Topbar({
  onOpenMobileSidebar,
  onOpenNotifications,
  title,
  subtitle,
}: TopbarProps) {
  const router = useRouter();
  const { currentUser, unreadCount, logout, syncState, syncError, refreshComplaints } = useCampusFix();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);

  const role = currentUser?.role || "student";

  const handleLogout = async () => {
    setLogoutError(null);
    const result = await logout();
    if (!result.success) {
      setLogoutError(result.error || "Unable to sign out. Please try again.");
      return;
    }
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
      {/* Left: Mobile Menu & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
          aria-label="Open navigation sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            {title || "CampusFix Portal"}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions, Notifications, User Chip */}
      <div className="flex items-center gap-2 sm:gap-3">
        {currentUser && (
          <div className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-500" title={syncError || "Complaint data synchronization status"}>
            <span className={`h-2 w-2 rounded-full ${syncState === "error" ? "bg-rose-500" : syncState === "syncing" || syncState === "loading" ? "bg-amber-400 animate-pulse" : syncState === "realtime" ? "bg-emerald-500" : "bg-sky-500"}`} />
            <span>{syncState === "realtime" ? "Live" : syncState === "polling" ? "Synced" : syncState === "error" ? "Sync issue" : "Updating"}</span>
            {syncState === "error" && <button type="button" onClick={() => void refreshComplaints()} className="ml-1 inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline" aria-label="Retry complaint synchronization"><RefreshCw className="h-3 w-3" />Retry</button>}
          </div>
        )}
        {/* Quick CTA */}
        {role === "student" ? (
          <Link
            href="/student/submit"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Submit Complaint</span>
          </Link>
        ) : role === "admin" ? (
          <Link
            href="/admin/verification"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
          >
            <CheckSquare className="h-4 w-4" />
            <span>Review Queue</span>
          </Link>
        ) : (
          <Link
            href="/authority/tasks"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 transition-colors"
          >
            <Wrench className="h-4 w-4" />
            <span>Active Tasks</span>
          </Link>
        )}

        {/* Notification Bell */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg border border-slate-200/80 p-1.5 pr-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {currentUser?.name?.charAt(0) || "U"}
            </div>
            <div className="hidden text-left lg:block">
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {currentUser?.name || "User"}
              </span>
              <span className="block text-[10px] text-slate-400 leading-tight capitalize">
                {currentUser?.role === "admin"
                  ? "Staff Admin"
                  : isAuthorityRole(currentUser?.role)
                  ? "Department Authority"
                  : "Student"}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100">
                {logoutError && (
                  <p className="mb-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                    {logoutError}
                  </p>
                )}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {currentUser?.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser?.email}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    {currentUser?.role === "admin" ? (
                      <Shield className="h-3 w-3 text-amber-500" />
                    ) : isAuthorityRole(currentUser?.role) ? (
                      <Wrench className="h-3 w-3 text-sky-500" />
                    ) : (
                      <GraduationCap className="h-3 w-3 text-emerald-500" />
                    )}
                    <span className="capitalize">{isAuthorityRole(currentUser?.role) ? "Department Authority" : currentUser?.role} Account</span>
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    href="/help"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Help & FAQs
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
