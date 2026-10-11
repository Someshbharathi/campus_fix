"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Complaint,
  ComplaintCategory,
  NotificationItem,
  Priority,
  ResolutionStatus,
  Role,
  TimelineEvent,
  User,
  VerificationStatus,
} from "./types";
import {
  getCanonicalDepartment,
  getDatabaseCategory,
  getDepartmentForCategory,
} from "./department-routing";

interface CampusFixContextType {
  currentUser: User | null;
  complaints: Complaint[];
  notifications: NotificationItem[];
  isLoading: boolean;
  login: (email: string, password: string, role: Role) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
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

export const isAuthorityRole = (role?: string | null): boolean => {
  return role === "department_authority";
};

export const getRoleHomePath = (role?: string | null): string => {
  if (role === "admin") return "/admin";
  if (isAuthorityRole(role)) return "/authority";
  return "/student";
};

const normalizeRole = (role?: string | null): Role => {
  if (!role) return "student";
  if (role === "department_authority") {
    return "department_authority";
  }
  if (role === "admin") return "admin";
  return "student";
};

const getSupabaseConfigError = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.";
  }

  return null;
};

type DatabaseIssue = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  priority: Priority;
  priority_level?: Priority | null;
  priority_score?: number | null;
  ai_category?: string | null;
  ai_summary?: string | null;
  ai_reason?: string | null;
  routing_exception?: boolean;
  status_history?: Array<{
    id: string | number;
    actor_id: string;
    old_status: string;
    new_status: string;
    comment: string;
    created_at: string;
  }>;
  status: string;
  reporter_id?: string;
  assigned_department?: string | null;
  assigned_at?: string | null;
  image_path?: string | null;
  verification_status: string;
  verification_note?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
};

const mapDatabaseIssue = (issue: DatabaseIssue, user?: User | null): Complaint => {
  const verificationStatus: VerificationStatus =
    issue.verification_status === "approved"
      ? "verified"
      : issue.verification_status === "rejected"
      ? "rejected"
      : issue.verification_status === "needs_clarification"
      ? "info_requested"
      : issue.verification_status === "sensitive_review"
      ? "sensitive_review"
      : "awaiting_verification";

  const resolutionStatus: ResolutionStatus =
    issue.status === "reported"
      ? "awaiting_verification"
      : issue.status === "assigned"
        ? "pending_assignment"
        : issue.status === "in_progress" || issue.status === "resolved"
        ? issue.status
      : "submitted";

  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    category: issue.category as ComplaintCategory,
    campusLocation: issue.location,
    specificLocation: issue.location,
    evidenceUrl: issue.image_path || undefined,
    verificationStatus,
    verificationReason: issue.verification_note || undefined,
    verificationDate: issue.verified_at || undefined,
    resolutionStatus,
    priority: issue.priority_level || issue.priority,
    priorityScore: issue.priority_score ?? undefined,
    aiCategory: issue.ai_category as ComplaintCategory | undefined,
    aiSummary: issue.ai_summary || undefined,
    aiReason: issue.ai_reason || undefined,
    routingException: issue.routing_exception ?? false,
    assignedDepartment: issue.assigned_department || undefined,
    submittedBy: {
      id: issue.reporter_id || "unknown",
      name: issue.reporter_id === user?.id ? user?.name || "Campus Student" : "Campus Student",
      email: issue.reporter_id === user?.id ? user?.email || "" : "",
    },
    submittedAt: issue.created_at,
    assignedAt: issue.assigned_at || (issue.status === "assigned" ? issue.created_at : undefined),
    updatedAt: issue.updated_at,
    resolvedAt: issue.resolved_at || undefined,
    timeline: [
      {
        id: `${issue.id}-created`,
        title: "Complaint reported",
        description: issue.assigned_department ? `Routed to ${issue.assigned_department}.` : "Sent to the administrator exception queue.",
        timestamp: issue.created_at,
        status: issue.status,
        actor: issue.reporter_id === user?.id ? "You" : "Student",
        type: "created" as const,
      },
      ...(issue.status_history || []).map((event) => ({
        id: String(event.id),
        title: event.new_status === "in_progress" ? "Work in progress" : "Complaint resolved",
        description: event.comment,
        timestamp: event.created_at,
        status: event.new_status,
        actor: event.actor_id === user?.id ? `${user?.role || "User"}` : "Campus team",
        type: event.new_status === "resolved" ? "resolved" as const : "progress" as const,
      })),
    ],
  };
};

const apiError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    details?: string;
    code?: string;
    stage?: string;
  } | null;
  const reason = payload?.error || `Request failed with status ${response.status}.`;
  const metadata = [payload?.code, payload?.stage && `stage: ${payload.stage}`]
    .filter(Boolean)
    .join(" | ");
  const details = payload?.details && !reason.includes(payload.details)
    ? payload.details
    : "";
  return [reason, details, metadata].filter(Boolean).join("\n");
};

const backendDepartment = (department: string): string => {
  return getCanonicalDepartment(department) || getDepartmentForCategory(department) || department;
};

const buildProfileFromUser = async (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
  const supabase = createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, department")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Unable to load the user profile.");
  }

  if (!profile) {
    const name =
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
      (typeof user.email === "string" && user.email.split("@")[0]) ||
      "Campus User";

    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: name,
        role: "student",
      })
      .select("id, full_name, role, department")
      .single();

    if (insertError) {
      throw new Error(insertError.message || "Unable to create the user profile.");
    }

    return {
      id: insertedProfile.id,
      name: insertedProfile.full_name || name,
      email: user.email || "",
      role: normalizeRole(insertedProfile.role),
      department: insertedProfile.department ?? undefined,
      avatar: undefined,
    } satisfies User;
  }

  return {
    id: profile.id,
    name: profile.full_name || user.email || "Campus User",
    email: user.email || "",
    role: normalizeRole(profile.role),
    department: profile.department ?? undefined,
    avatar: undefined,
  } satisfies User;
};

export function CampusFixProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadComplaints = async (user: User, accessToken: string) => {
    const endpoint = isAuthorityRole(user.role)
      ? "/api/authority/issues"
      : "/api/issues";
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(await apiError(response));
    }

    const payload = (await response.json()) as { issues?: DatabaseIssue[] };
    setComplaints((payload.issues || []).map((issue) => mapDatabaseIssue(issue, user)));
  };

  useEffect(() => {
    const hydrateSession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setCurrentUser(null);
          setComplaints([]);
          setNotifications([]);
          return;
        }

        const user = await buildProfileFromUser(session.user);
        setCurrentUser(user);
        if (session.access_token) {
          await loadComplaints(user, session.access_token);
        }
      } catch {
        setComplaints([]);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateSession();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setComplaints([]);
        setNotifications([]);
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        try {
          const user = await buildProfileFromUser(session.user);
          setCurrentUser(user);
          await loadComplaints(user, session.access_token);
        } catch {
          setComplaints([]);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync state helpers
  const saveComplaints = (newComplaints: Complaint[]) => {
    setComplaints(newComplaints);
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
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    const configError = getSupabaseConfigError();
    if (configError) {
      return { success: false, error: configError };
    }

    if (!email || !email.includes("@")) {
      return { success: false, error: "Please provide a valid college email address." };
    }

    if (!password || password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    try {
      const supabase = createClient();
      const {
        data: { user, session },
        error,
      } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !user) {
        return { success: false, error: error?.message || "Invalid email or password." };
      }

      const profile = await buildProfileFromUser(user);
      const expectedRole = normalizeRole(role);
      if (profile.role !== expectedRole) {
        await supabase.auth.signOut();
        const expectedRoleLabel =
          expectedRole === "department_authority" ? "Department Authority" : expectedRole;
        return {
          success: false,
          error: `This account is not registered as a ${expectedRoleLabel}.`,
        };
      }

      saveUser(profile);
      if (session?.access_token) {
        void loadComplaints(profile, session.access_token).catch(() => {
          setComplaints([]);
        });
      }
      return { success: true, user: profile };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Authentication could not be completed. Please try again.",
      };
    }
  };

  const logout = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { success: false, error: error.message || "Unable to sign out." };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unable to sign out.",
      };
    }

    saveUser(null);
    setComplaints([]);
    setNotifications([]);
    return { success: true };
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
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");

    const response = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        category: getDatabaseCategory(data.category),
        location: `${data.campusLocation} - ${data.specificLocation}`,
      }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    const payload = (await response.json()) as {
      issue: DatabaseIssue;
      analysis?: { available: boolean; category: ComplaintCategory | null; summary: string | null; priority: Priority; priorityScore: number; reason: string | null };
    };
    const created = mapDatabaseIssue(payload.issue, currentUser);
    if (payload.analysis) {
      created.priority = payload.analysis.priority;
      created.priorityScore = payload.analysis.priorityScore;
      created.aiCategory = payload.analysis.category ?? undefined;
      created.aiSummary = payload.analysis.summary ?? undefined;
      created.aiReason = payload.analysis.reason ?? undefined;
      created.aiAvailable = payload.analysis.available;
    }
    if (currentUser) {
      await loadComplaints(currentUser, token);
    }
    return created;
  };

  const verifyComplaint = async (id: string, verified: boolean, reason?: string): Promise<void> => {
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`/api/admin/issues/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        decision: verified ? "approved" : "rejected",
        note: reason?.trim() || undefined,
      }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    setComplaints((previous) => previous.map((item) => item.id === id
      ? { ...item, verificationStatus: verified ? "verified" : "rejected", verificationReason: reason }
      : item));
  };

  const forwardComplaint = async (
    id: string,
    department: string,
    person?: string,
    priority?: Priority,
    directives?: string
  ): Promise<void> => {
    await verifyComplaint(id, true, directives);
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`/api/admin/issues/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ department: backendDepartment(department) }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    setComplaints((previous) => previous.map((item) => item.id === id
      ? { ...item, verificationStatus: "verified", resolutionStatus: "submitted", assignedDepartment: department }
      : item));
  };

  const requestAdditionalInfo = async (id: string, message: string): Promise<void> => {
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`/api/admin/issues/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ decision: "needs_clarification", note: message.trim() }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    setComplaints((previous) => previous.map((item) => item.id === id
      ? { ...item, verificationStatus: "info_requested", verificationReason: message }
      : item));
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
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`/api/admin/issues/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ department: backendDepartment(department) }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    setComplaints((previous) => previous.map((item) => item.id === id
      ? { ...item, assignedDepartment: department, resolutionStatus: "submitted" }
      : item));
  };

  const updatePriority = async (id: string, priority: Priority): Promise<void> => {
    if (currentUser?.role !== "admin") throw new Error("Only administrators can override priority.");
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`/api/admin/issues/${id}/priority`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ priority }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    const payload = await response.json() as { issue: { updated_at: string } };
    setComplaints((previous) => previous.map((item) => item.id === id
      ? { ...item, priority, updatedAt: payload.issue.updated_at }
      : item));
  };

  const updateStatus = async (
    id: string,
    status: ResolutionStatus,
    notes?: string
  ): Promise<void> => {
    if (status !== "in_progress" && status !== "resolved") {
      throw new Error("Only in-progress and resolved status updates are supported by the backend.");
    }
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const endpoint = currentUser?.role === "admin"
      ? `/api/admin/issues/${id}/status`
      : `/api/authority/issues/${id}/status`;
    const statusComment = notes?.trim() || (currentUser?.role === "admin"
      ? "Status updated by an administrator."
      : "Status updated by department authority.");
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, comment: statusComment }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    const payload = await response.json() as {
      history?: { id: string | number; actor_id: string; new_status: string; comment: string; created_at: string };
    };
    setComplaints((previous) => previous.map((item) => item.id === id
      ? {
        ...item,
        resolutionStatus: status,
        resolutionNotes: notes,
        updatedAt: payload.history?.created_at || new Date().toISOString(),
        resolvedAt: status === "resolved" ? payload.history?.created_at || new Date().toISOString() : item.resolvedAt,
        timeline: payload.history ? [...item.timeline, {
          id: String(payload.history.id),
          title: status === "in_progress" ? "Work in progress" : "Complaint resolved",
          description: payload.history.comment,
          timestamp: payload.history.created_at,
          status: payload.history.new_status,
          actor: currentUser?.role === "admin" ? "Administrator" : "Department authority",
          type: status === "resolved" ? "resolved" as const : "progress" as const,
        }] : item.timeline,
      }
      : item));
  };

  const resolveComplaintByAuthority = async (
    id: string,
    resolutionNotes: string,
    resolutionProofUrl?: string,
    resolutionProofName?: string
  ): Promise<void> => {
    await updateStatus(id, "resolved", resolutionNotes);
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
