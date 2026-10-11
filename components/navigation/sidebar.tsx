"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  CheckSquare,
  BarChart3,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Building2,
  Wrench,
  User,
  Bell,
  X,
} from "lucide-react";
import { getRoleHomePath, isAuthorityRole, useCampusFix } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onCloseMobile?: () => void;
  onOpenNotifications?: () => void;
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense
      fallback={
        <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-full border-r border-slate-800" />
      }
    >
      <SidebarContent {...props} />
    </Suspense>
  );
}

function SidebarContent({ onCloseMobile, onOpenNotifications }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, complaints, unreadCount } = useCampusFix();
  const [logoutError, setLogoutError] = React.useState<string | null>(null);

  const role = currentUser?.role || "student";
  const awaitingVerificationCount = complaints.filter(
    (c) => c.verificationStatus === "awaiting_verification"
  ).length;

  const assignedToAuthorityCount = complaints.filter(
    (c) =>
      c.resolutionStatus === "in_progress" ||
      c.resolutionStatus === "pending_assignment"
  ).length;

  interface NavItem {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }

  const studentNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/student",
      icon: LayoutDashboard,
    },
    {
      title: "Submit Complaint",
      href: "/student/submit",
      icon: PlusCircle,
    },
    {
      title: "My Complaints",
      href: "/student/complaints",
      icon: ClipboardList,
      badge: complaints.filter((c) => c.submittedBy.id === currentUser?.id).length,
    },
    {
      title: "Help & Guidelines",
      href: "/help",
      icon: HelpCircle,
    },
  ];

  const adminNavItems: NavItem[] = [
    {
      title: "Overview",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      title: "Verification Queue",
      href: "/admin/verification",
      icon: CheckSquare,
      badge: awaitingVerificationCount,
      badgeColor: "bg-amber-500 text-white",
    },
    {
      title: "Reports & Analytics",
      href: "/admin/reports",
      icon: BarChart3,
    },
    {
      title: "Portal Guidelines",
      href: "/help",
      icon: HelpCircle,
    },
  ];

  const authorityNavItems: NavItem[] = [
    {
      title: "Work Orders",
      href: "/authority",
      icon: LayoutDashboard,
    },
    {
      title: "Active Tasks",
      href: "/authority/tasks",
      icon: Wrench,
      badge: assignedToAuthorityCount,
      badgeColor: "bg-sky-500 text-white",
    },
    {
      title: "Completed History",
      href: "/authority/completed",
      icon: CheckSquare,
    },
    {
      title: "Portal Guidelines",
      href: "/help",
      icon: HelpCircle,
    },
  ];

  const navItems =
    role === "admin"
      ? adminNavItems
      : isAuthorityRole(role)
      ? authorityNavItems
      : studentNavItems;

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
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-full border-r border-slate-800 shadow-xl select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
        <Link
          href={getRoleHomePath(role)}
          className="flex items-center gap-3 group"
          onClick={onCloseMobile}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white">CampusFix</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                G-26
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Complaint Portal</p>
          </div>
        </Link>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                <span>{item.title}</span>
              </div>
              {typeof item.badge !== "undefined" && item.badge > 0 && (
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-bold",
                    item.badgeColor ||
                      (isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300")
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Notifications button on mobile */}
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-all"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-slate-400" />
              <span>Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500 text-white font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        )}
      </nav>

      {/* User Footer & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        {logoutError && (
          <p className="mb-2 rounded-lg border border-rose-900/60 bg-rose-950/40 px-2.5 py-2 text-[11px] text-rose-300">
            {logoutError}
          </p>
        )}
        <div className="p-2.5 rounded-xl bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser?.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {currentUser?.name || "Campus User"}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentUser?.rollNumber || currentUser?.department || currentUser?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            title="Log out of CampusFix"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
