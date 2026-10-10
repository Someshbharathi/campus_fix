"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { INITIAL_COMPLAINTS, INITIAL_NOTIFICATIONS, SAMPLE_USERS } from "./sample-data";
import {
  Complaint,
  ComplaintCategory,
  NotificationItem,
  Priority,
  ResolutionStatus,
  Role,
  TimelineEvent,
  User,
} from "./types";

interface CampusFixContextType {
  currentUser: User | null;
  complaints: Complaint[];
  notifications: NotificationItem[];
  isLoading: boolean;
  login: (email: string, password: string, role: Role) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: Role) => void;
  submitComplaint: (data: {
    title: string;
    category: ComplaintCategory;
    description: string;
    campusLocation: string;
    specificLocation: string;
    evidenceName?: string;
    evidenceUrl?: string;
    priority?: Priority;
  }) => Promise<Complaint>;
  verifyComplaint: (id: string, verified: boolean, reason?: string) => Promise<void>;
  forwardComplaint: (
    id: string,
    department: string,
    person?: string,
    priority?: Priority,
    directives?: string
  ) => Promise<void>;
  requestAdditionalInfo: (id: string, message: string) => Promise<void>;
  provideAdditionalInfo: (id: string, message: string) => Promise<void>;
  assignDepartment: (id: string, department: string, person?: string) => Promise<void>;
  updatePriority: (id: string, priority: Priority) => Promise<void>;
  updateStatus: (id: string, status: ResolutionStatus, notes?: string) => Promise<void>;
  resolveComplaintByAuthority: (
    id: string,
    resolutionNotes: string,
    resolutionProofUrl?: string,
    resolutionProofName?: string
  ) => Promise<void>;
  confirmResolution: (id: string) => Promise<void>;
  reopenComplaint: (id: string, reason: string) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  getComplaintById: (id: string) => Complaint | undefined;
  unreadCount: number;
}

const CampusFixContext = createContext<CampusFixContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "campusfix_user",
  COMPLAINTS: "campusfix_complaints",
  NOTIFICATIONS: "campusfix_notifications",
};

export function CampusFixProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(SAMPLE_USERS.student);
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize from localStorage if present
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      } else {
        setCurrentUser(SAMPLE_USERS.student);
      }

      const storedComplaints = localStorage.getItem(STORAGE_KEYS.COMPLAINTS);
      if (storedComplaints) {
        setComplaints(JSON.parse(storedComplaints));
      }

      const storedNotifs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (storedNotifs) {
        setNotifications(JSON.parse(storedNotifs));
      }
    } catch {
      // Fallback to initial state
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync state helpers
  const saveComplaints = (newComplaints: Complaint[]) => {
    setComplaints(newComplaints);
    try {
      localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(newComplaints));
    } catch {
      // LocalStorage quota or unavailable
    }
  };

  const saveNotifications = (newNotifs: NotificationItem[]) => {
    setNotifications(newNotifs);
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(newNotifs));
    } catch {
      // LocalStorage error
    }
  };

  const saveUser = (user: User | null) => {
    setCurrentUser(user);
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch {
      // LocalStorage error
    }
  };

  const login = async (
    email: string,
    password: string,
    role: Role
  ): Promise<{ success: boolean; error?: string }> => {
    // Artificial slight delay for realistic UI loading feedback
    await new Promise((r) => setTimeout(r, 600));

    if (!email || !email.includes("@")) {
      return { success: false, error: "Please provide a valid college email address." };
    }
    if (!password || password.length < 4) {
      return { success: false, error: "Password must be at least 4 characters long." };
    }

    const matchedUser: User = {
      id:
        role === "student"
          ? "usr_student_01"
          : role === "admin"
          ? "usr_admin_01"
          : "usr_auth_01",
      name:
        role === "student"
          ? "Rohan Verma"
          : role === "admin"
          ? "Dr. Meenakshi Sundaram"
          : "Er. Rajesh Sharma",
      email: email,
      role: role,
      rollNumber: role === "student" ? "23BCE1048" : undefined,
      department:
        role === "student"
          ? "Computer Science & Engineering"
          : role === "admin"
          ? "Campus Estate & Student Grievance Cell"
          : "Electrical Maintenance",
      avatar:
        role === "student"
          ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
          : role === "admin"
          ? "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    };

    saveUser(matchedUser);
    return { success: true };
  };

  const logout = () => {
    saveUser(null);
  };

  const switchRole = (role: Role) => {
    saveUser(SAMPLE_USERS[role]);
  };

  const submitComplaint = async (data: {
    title: string;
    category: ComplaintCategory;
    description: string;
    campusLocation: string;
    specificLocation: string;
    evidenceName?: string;
    evidenceUrl?: string;
    priority?: Priority;
  }): Promise<Complaint> => {
    await new Promise((r) => setTimeout(r, 700));

    const nextNumber = complaints.length + 845;
    const complaintId = `CF-2026-${String(nextNumber).padStart(4, "0")}`;
    const nowIso = new Date().toISOString();

    const newTimelineEvent: TimelineEvent = {
      id: `evt-${Date.now()}-1`,
      title: "Complaint Submitted",
      description: `Logged by ${currentUser?.name || "Student"}. Queued for administrative review and verification.`,
      timestamp: nowIso,
      status: "Submitted",
      actor: `Student (${currentUser?.name || "Student"})`,
      type: "created",
    };

    const newComplaint: Complaint = {
      id: complaintId,
      title: data.title,
      category: data.category,
      description: data.description,
      campusLocation: data.campusLocation,
      specificLocation: data.specificLocation,
      evidenceName: data.evidenceName,
      evidenceUrl: data.evidenceUrl,
      verificationStatus: "awaiting_verification",
      resolutionStatus: "awaiting_verification",
      priority: data.priority || "medium",
      submittedBy: {
        id: currentUser?.id || "usr_student_01",
        name: currentUser?.name || "Rohan Verma",
        email: currentUser?.email || "rohan.verma@campus.edu",
        rollNumber: currentUser?.rollNumber || "23BCE1048",
      },
      submittedAt: nowIso,
      updatedAt: nowIso,
      timeline: [newTimelineEvent],
    };

    const updatedComplaints = [newComplaint, ...complaints];
    saveComplaints(updatedComplaints);

    // Add notification
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: "Complaint Registered",
      message: `Your complaint ${complaintId} has been successfully submitted and is awaiting verification.`,
      timestamp: nowIso,
      read: false,
      complaintId: complaintId,
      type: "status",
    };
    saveNotifications([newNotif, ...notifications]);

    return newComplaint;
  };

  const verifyComplaint = async (id: string, verified: boolean, reason?: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));
    const nowIso = new Date().toISOString();

    const updatedComplaints = complaints.map((c) => {
      if (c.id !== id) return c;

      const newTimeline: TimelineEvent[] = [
        ...c.timeline,
        {
          id: `evt-${Date.now()}`,
          title: verified ? "Complaint Verified" : "Complaint Rejected",
          description: verified
            ? reason || `Verified by ${currentUser?.name || "Administrator"}. Approved for resolution dispatch.`
            : `Rejected during screening: ${reason || "Does not meet submission criteria."}`,
          timestamp: nowIso,
          status: verified ? "Verified" : "Rejected",
          actor: `Admin (${currentUser?.name || "Administrator"})`,
          type: verified ? "verified" : "rejected",
        },
      ];

      return {
        ...c,
        verificationStatus: verified ? ("verified" as const) : ("rejected" as const),
        verificationReason: reason,
        verificationDate: nowIso,
        resolutionStatus: verified
          ? ("pending_assignment" as const)
          : ("rejected" as const),
        updatedAt: nowIso,
        timeline: newTimeline,
      };
    });

    saveComplaints(updatedComplaints);

    // Add notification for the student
    const target = complaints.find((c) => c.id === id);
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: verified ? "Complaint Verified" : "Complaint Rejected",
      message: verified
        ? `Complaint ${id} was verified by the administration and is awaiting department dispatch.`
        : `Complaint ${id} was rejected: ${reason || "Declined during verification review."}`,
      timestamp: nowIso,
      read: false,
      complaintId: id,
      type: "verification",
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const forwardComplaint = async (
    id: string,
    department: string,
    person?: string,
    priority?: Priority,
    directives?: string
  ): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));
    const nowIso = new Date().toISOString();

    const updatedComplaints = complaints.map((c) => {
      if (c.id !== id) return c;

      const newTimeline: TimelineEvent[] = [
        ...c.timeline,
        {
          id: `evt-${Date.now()}`,
          title: `Verified & Forwarded to ${department}`,
          description: directives
            ? `Verified by Administrator. Dispatched to ${department}${person ? ` (${person})` : ""}. Directives: "${directives}"`
            : `Verified by Administrator and forwarded to ${department}${person ? ` (${person})` : ""} for field execution.`,
          timestamp: nowIso,
          status: "Assigned & In Progress",
          actor: `Admin (${currentUser?.name || "Administrator"})`,
          type: "assigned",
        },
      ];

      return {
        ...c,
        verificationStatus: "verified" as const,
        verificationReason: directives || `Verified and forwarded to ${department}`,
        verificationDate: nowIso,
        resolutionStatus: "in_progress" as const,
        assignedDepartment: department,
        assignedPerson: person || c.assignedPerson || `${department} Field Team`,
        priority: priority || c.priority,
        updatedAt: nowIso,
        timeline: newTimeline,
      };
    });

    saveComplaints(updatedComplaints);

    // Notification for student
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: "Complaint Forwarded to Authority",
      message: `Complaint ${id} was verified and forwarded to ${department}${person ? ` (${person})` : ""} for execution.`,
      timestamp: nowIso,
      read: false,
      complaintId: id,
      type: "assignment",
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const requestAdditionalInfo = async (id: string, message: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));
    const nowIso = new Date().toISOString();

    const updatedComplaints = complaints.map((c) => {
      if (c.id !== id) return c;

      const newTimeline: TimelineEvent[] = [
        ...c.timeline,
        {
          id: `evt-${Date.now()}`,
          title: "Additional Information Requested",
          description: message,
          timestamp: nowIso,
          status: "Info Requested",
          actor: `Admin (${currentUser?.name || "Administrator"})`,
          type: "info_requested",
        },
      ];

      return {
        ...c,
        verificationStatus: "info_requested" as const,
        additionalInfoRequested: message,
        updatedAt: nowIso,
        timeline: newTimeline,
      };
    });

    saveComplaints(updatedComplaints);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: "Action Required: Info Requested",
      message: `Admin requested additional details for complaint ${id}: "${message}"`,
      timestamp: nowIso,
      read: false,
      complaintId: id,
      type: "info",
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const provideAdditionalInfo = async (id: string, message: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));
    const nowIso = new Date().toISOString();

    const updatedComplaints = complaints.map((c) => {
      if (c.id !== id) return c;

      const newTimeline: TimelineEvent[] = [
        ...c.timeline,
        {
          id: `evt-${Date.now()}`,
          title: "Additional Information Provided",
          description: message,
          timestamp: nowIso,
          status: "Info Provided",
          actor: `Student (${currentUser?.name || "Student"})`,
          type: "info_provided",
        },
      ];

      return {
        ...c,
        verificationStatus: "awaiting_verification" as const,
        additionalInfoProvided: message,
        updatedAt: nowIso,
        timeline: newTimeline,
      };
    });

    saveComplaints(updatedComplaints);
  };

  const assignDepartment = async (
    id: string,
    department: string,
    person?: string
  ): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));
    const nowIso = new Date().toISOString();

    const updatedComplaints = complaints.map((c) => {
      if (c.id !== id) return c;

      const newTimeline: TimelineEvent[] = [
        ...c.timeline,
        {
          id: `evt-${Date.now()}`,
          title: `Assigned to ${department}`,
          description: person
            ? `Assigned to technician ${person}.`
            : `Assigned to ${department} team for resolution.`,
          timestamp: nowIso,
          status: "Assigned",
          actor: `Admin (${currentUser?.name || "Dispatch"})`,
          type: "assigned",
        },
      ];

      return {
        ...c,
        assignedDepartment: department,
        assignedPerson: person || c.assignedPerson,
        resolutionStatus: "in_progress" as const,
        updatedAt: nowIso,
        timeline: newTimeline,
      };
    });

    saveComplaints(updatedComplaints);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: "Department Assigned",
      message: `Complaint ${id} was assigned to ${department}${person ? ` (${person})` : ""}.`,
      timestamp: nowIso,
      read: false,
      complaintId: id,
      type: "assignment",
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const updatePriority = async (id: string, priority: Priority): Promise<void> => {
    const nowIso = new Date().toISOString();
    const updated = complaints.map((c) =>
      c.id === id ? { ...c, priority, updatedAt: nowIso } : c
    );
    saveComplaints(updated);
  };

  const updateStatus = async (
    id: string,
    status: ResolutionStatus,
    notes?: string
  ): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));
    const nowIso = new Date().toISOString();

    const updatedComplaints: Complaint[] = complaints.map((c) => {
      if (c.id !== id) return c;

      let eventType: TimelineEvent["type"] = "progress";
      let eventTitle = `Status updated to ${status.replace("_", " ")}`;
      if (status === "resolved") {
        eventType = "resolved";
        eventTitle = "Complaint Resolved";
      } else if (status === "in_progress") {
        eventType = "progress";
        eventTitle = "Work In Progress";
      }

      const newEvent: TimelineEvent = {
        id: `evt-${Date.now()}`,
        title: eventTitle,
        description: notes || `Complaint status updated to ${status.replace("_", " ")}.`,
        timestamp: nowIso,
        status: status,
        actor: currentUser?.name || "Staff",
        type: eventType,
      };

      const newTimeline: TimelineEvent[] = [...c.timeline, newEvent];

      return {
        ...c,
        resolutionStatus: status,
        resolutionNotes: notes || c.resolutionNotes,
        resolvedAt: status === "resolved" ? nowIso : c.resolvedAt,
        updatedAt: nowIso,
        timeline: newTimeline,
      };
    });

    saveComplaints(updatedComplaints);

    if (status === "resolved") {
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: "Complaint Resolved",
        message: `Complaint ${id} has been resolved! Check resolution details and confirm.`,
        timestamp: nowIso,
        read: false,
        complaintId: id,
        type: "status",
      };
      saveNotifications([newNotif, ...notifications]);
    }
  };

  const resolveComplaintByAuthority = async (
    id: string,
    resolutionNotes: string,
    resolutionProofUrl?: string,
    resolutionProofName?: string
  ): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));
    const nowIso = new Date().toISOString();

    const updatedComplaints: Complaint[] = complaints.map((c) => {
      if (c.id !== id) return c;

      const newEvent: TimelineEvent = {
        id: `evt-${Date.now()}`,
        title: "Task Resolved by Authority",
        description: resolutionNotes || "Maintenance work completed and verified on-site.",
        timestamp: nowIso,
        status: "resolved",
        actor: `Authority (${currentUser?.name || "Field Officer"})`,
        type: "resolved",
      };

      return {
        ...c,
        resolutionStatus: "resolved" as const,
        resolutionNotes: resolutionNotes,
        resolutionProofUrl: resolutionProofUrl || c.resolutionProofUrl,
        resolutionProofName: resolutionProofName || c.resolutionProofName,
        resolvedAt: nowIso,
        updatedAt: nowIso,
        timeline: [...c.timeline, newEvent],
      };
    });

    saveComplaints(updatedComplaints);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: "Task Resolved by Field Authority",
      message: `Complaint ${id} has been resolved by ${currentUser?.name || "the Authority"}. Check fix notes and confirm.`,
      timestamp: nowIso,
      read: false,
      complaintId: id,
      type: "status",
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const confirmResolution = async (id: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 400));
    const nowIso = new Date().toISOString();

    const updatedComplaints: Complaint[] = complaints.map((c) => {
      if (c.id !== id) return c;
      const newEvent: TimelineEvent = {
        id: `evt-${Date.now()}`,
        title: "Resolution Confirmed by Student",
        description: "Student confirmed the repair/fix is satisfactory.",
        timestamp: nowIso,
        status: "Resolved & Confirmed",
        actor: `Student (${currentUser?.name || "Student"})`,
        type: "resolved",
      };
      return {
        ...c,
        timeline: [...c.timeline, newEvent],
      };
    });

    saveComplaints(updatedComplaints);
  };

  const reopenComplaint = async (id: string, reason: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 500));
    const nowIso = new Date().toISOString();

    const updatedComplaints: Complaint[] = complaints.map((c) => {
      if (c.id !== id) return c;
      const newEvent: TimelineEvent = {
        id: `evt-${Date.now()}`,
        title: "Complaint Reopened",
        description: reason,
        timestamp: nowIso,
        status: "Reopened",
        actor: `Student (${currentUser?.name || "Student"})`,
        type: "reopened",
      };
      return {
        ...c,
        resolutionStatus: "reopened" as const,
        updatedAt: nowIso,
        timeline: [...c.timeline, newEvent],
      };
    });

    saveComplaints(updatedComplaints);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: "Complaint Reopened",
      message: `Complaint ${id} was reopened by the student: "${reason}"`,
      timestamp: nowIso,
      read: false,
      complaintId: id,
      type: "status",
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const markNotificationRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotifications(updated);
  };

  const markAllNotificationsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const getComplaintById = (id: string) => {
    return complaints.find((c) => c.id === id);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <CampusFixContext.Provider
      value={{
        currentUser,
        complaints,
        notifications,
        isLoading,
        login,
        logout,
        switchRole,
        submitComplaint,
        verifyComplaint,
        forwardComplaint,
        requestAdditionalInfo,
        provideAdditionalInfo,
        assignDepartment,
        updatePriority,
        updateStatus,
        resolveComplaintByAuthority,
        confirmResolution,
        reopenComplaint,
        markNotificationRead,
        markAllNotificationsRead,
        getComplaintById,
        unreadCount,
      }}
    >
      {children}
    </CampusFixContext.Provider>
  );
}

export function useCampusFix() {
  const context = useContext(CampusFixContext);
  if (!context) {
    throw new Error("useCampusFix must be used within a CampusFixProvider");
  }
  return context;
}
