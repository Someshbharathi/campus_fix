"use client";

import React, { useState, Suspense } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { Topbar } from "@/components/navigation/topbar";
import { NotificationDrawer } from "@/components/navigation/notification-drawer";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100/70 dark:bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar onOpenNotifications={() => setNotificationsOpen(true)} />
      </div>

      {/* Mobile Sidebar Modal */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col">
            <Sidebar
              onCloseMobile={() => setMobileSidebarOpen(false)}
              onOpenNotifications={() => {
                setMobileSidebarOpen(false);
                setNotificationsOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          title="CampusFix Administration Console"
          subtitle="Complaint verification, department dispatch & resolution oversight"
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading page...</div>}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
}
