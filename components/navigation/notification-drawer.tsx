"use client";

import React from "react";
import { X, CheckCheck, Bell, ExternalLink } from "lucide-react";
import Link from "next/link";
import { isAuthorityRole, useCampusFix } from "@/lib/store";
import { cn } from "@/lib/utils";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const { notifications, markNotificationRead, markAllNotificationsRead, currentUser } =
    useCampusFix();

  if (!isOpen) return null;

  const rolePrefix = currentUser?.role === "admin" ? "/admin" : isAuthorityRole(currentUser?.role) ? "/authority" : "/student";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-950/60 dark:text-indigo-400">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  CampusFix Notifications
                </h3>
                <p className="text-xs text-slate-500">Live complaint tracking updates</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="p-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Bell className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">No notifications right now</p>
                <p className="text-xs mt-1">Updates regarding your complaints will appear here.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markNotificationRead(item.id)}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer relative",
                    item.read
                      ? "bg-slate-50/70 border-slate-200/60 dark:bg-slate-900/60 dark:border-slate-800/60 opacity-80"
                      : "bg-white border-indigo-200 shadow-xs dark:bg-slate-900 dark:border-indigo-900/80"
                  )}
                >
                  {!item.read && (
                    <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 pr-4">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.message}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {item.complaintId && (
                      <Link
                        href={
                          currentUser?.role === "admin"
                            ? `/admin/complaints/${item.complaintId}`
                            : isAuthorityRole(currentUser?.role)
                            ? `/authority/complaints/${item.complaintId}`
                            : `/student/complaints/${item.complaintId}`
                        }
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium dark:text-indigo-400"
                      >
                        View {item.complaintId}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
