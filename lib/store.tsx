"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AIComplaintCategory } from "@/lib/ai/categories";
import { normalizeProfileRole } from "@/lib/auth/roles";
import {
  Complaint,
  ComplaintCategory,
  NotificationItem,
  Priority,
  ResolutionStatus,
  Role,
  User,
  VerificationStatus,
} from "./types";
import {
  getCanonicalDepartment,
  getDepartmentForCategory,
} from "./department-routing";

interface CampusFixContextType {
  currentUser: User | null;
  complaints: Complaint[];
  notifications: NotificationItem[];
  isLoading: boolean;
  syncState: "loading" | "syncing" | "realtime" | "polling" | "error";
  syncError: string | null;
  refreshComplaints: () => Promise<void>;
  login: (email: string, password: string, role: Role) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  submitComplaint: (data: {
    title: string;
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
  updateAIComplaintCategory: (id: string, category: AIComplaintCategory) => Promise<void>;
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
  READ_NOTIFICATIONS: "campusfix_read_notifications",
};

function deriveNotifications(complaints: Complaint[], readIds: Set<string>): NotificationItem[] {
  const items: NotificationItem[] = [];
  for (const complaint of complaints) {
    for (const event of complaint.timeline.slice(1)) {
      const type: NotificationItem["type"] = event.type === "progress" || event.type === "resolved" ? "status" : "info";
      items.push({
        id: event.id,
        title: event.title,
        message: `Complaint ${complaint.id}: ${event.description}`,
        timestamp: event.timestamp,
        read: readIds.has(event.id),
        complaintId: complaint.id,
        type,
      });
    }
    if (complaint.verificationStatus !== "awaiting_verification" && complaint.updatedAt > complaint.submittedAt) {
      const id = `verification:${complaint.id}:${complaint.verificationStatus}:${complaint.verificationDate || complaint.submittedAt}`;
      items.push({
        id,
        title: complaint.verificationStatus === "verified" ? "Complaint approved" : complaint.verificationStatus === "rejected" ? "Complaint rejected" : complaint.verificationStatus === "info_requested" ? "More information requested" : "Complaint review updated",
        message: `Complaint ${complaint.id}${complaint.verificationReason ? `: ${complaint.verificationReason}` : " has a verification update."}`,
        timestamp: complaint.verificationDate || complaint.updatedAt,
        read: readIds.has(id),
        complaintId: complaint.id,
        type: "verification",
      });
    }
  }
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export const isAuthorityRole = (role?: string | null): boolean => {
  return normalizeProfileRole(role) === "department_authority";
};

export const getRoleHomePath = (role?: string | null): string => {
  if (role === "admin") return "/admin";
  if (isAuthorityRole(role)) return "/authority";
  return "/student";
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
  ai_safety?: number | null;
  ai_severity?: number | null;
  ai_urgency?: number | null;
  ai_frequency?: number | null;
  ai_affected_population?: number | null;
  ai_spam?: boolean | null;
  ai_spam_reason?: string | null;
  ai_recurrence_count?: number | null;
  ai_similarity_score?: number | null;
  similar_complaints?: Array<{
    id: string;
    category: string;
    similarity: number;
    same_category: boolean;
  }>;
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
  additional_info_provided?: string | null;
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
    additionalInfoProvided: issue.additional_info_provided || undefined,
    verificationDate: issue.verified_at || undefined,
    resolutionStatus,
    priority: issue.priority_level || issue.priority,
    priorityScore: issue.priority_score ?? undefined,
    aiCategory: issue.ai_category as Complaint["aiCategory"],
    aiSummary: issue.ai_summary || undefined,
    aiReason: issue.ai_reason || undefined,
    aiSafety: issue.ai_safety ?? undefined,
    aiSeverity: issue.ai_severity ?? undefined,
    aiUrgency: issue.ai_urgency ?? undefined,
    aiFrequency: issue.ai_frequency ?? undefined,
    aiAffectedPopulation: issue.ai_affected_population ?? undefined,
    aiSpam: issue.ai_spam ?? undefined,
    aiSpamReason: issue.ai_spam_reason || undefined,
    aiRecurrenceCount: issue.ai_recurrence_count ?? undefined,
    aiSimilarityScore: issue.ai_similarity_score ?? undefined,
    similarComplaints: issue.similar_complaints?.map((match) => ({
      id: match.id,
      category: match.category as NonNullable<Complaint["aiCategory"]>,
      similarity: match.similarity,
      sameCategory: match.same_category,
    })),
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
        title: event.comment.startsWith("Student provided additional information:")
          ? "Additional Information Provided"
          : event.comment.startsWith("Student confirmed resolution:")
            ? "Resolution Confirmed by Student"
            : event.comment.startsWith("Student reopened complaint:")
              ? "Complaint Reopened"
              : event.new_status === "in_progress" ? "Work in progress" : event.new_status === "resolved" ? "Complaint resolved" : "Complaint status updated",
        description: event.comment.replace(/^Student (?:provided additional information|confirmed resolution|reopened complaint):\s*/, ""),
        timestamp: event.created_at,
        status: event.new_status,
        actor: event.actor_id === user?.id ? `${user?.role || "User"}` : "Campus team",
        type: event.comment.startsWith("Student provided additional information:") ? "info_provided" as const : event.comment.startsWith("Student reopened complaint:") ? "reopened" as const : event.new_status === "resolved" ? "resolved" as const : "progress" as const,
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
    .select("id, full_name, role, department, authority_scope")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Unable to load the user profile.");
  }

  if (!profile) {
    throw new Error("No CampusFix profile is registered for this account. Contact an administrator to restore your profile.");
  }

  if (profile.id !== user.id) throw new Error("The CampusFix profile does not match the signed-in account.");
  const role = normalizeProfileRole(profile.role);
  if (!role) throw new Error("This CampusFix profile has an invalid role. Contact an administrator.");

  return {
    id: profile.id,
    name: profile.full_name || user.email || "Campus User",
    email: user.email || "",
    role,
    department: profile.department ?? undefined,
    authorityScope: profile.authority_scope as User["authorityScope"],
    avatar: undefined,
  } satisfies User;
};

export function CampusFixProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<"loading" | "syncing" | "realtime" | "polling" | "error">("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const activeLoadRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const syncTransportRef = useRef<"realtime" | "polling">("polling");

  const loadComplaints = async (user: User, accessToken: string) => {
    if (activeLoadRef.current) {
      refreshQueuedRef.current = true;
      return activeLoadRef.current;
    }

    const endpoint = isAuthorityRole(user.role)
      ? "/api/authority/issues"
      : "/api/issues";
    const task = (async () => {
      try {
        do {
          refreshQueuedRef.current = false;
          setSyncState("syncing");
          const response = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          });
          if (!response.ok) throw new Error(await apiError(response));
          const payload = (await response.json()) as { issues?: DatabaseIssue[] };
          setComplaints((payload.issues || []).map((issue) => mapDatabaseIssue(issue, user)));
        } while (refreshQueuedRef.current);
        setSyncError(null);
        setSyncState(syncTransportRef.current);
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Could not synchronize complaint data.");
        setSyncState("error");
        throw error;
      }
    })();
    activeLoadRef.current = task;
    try {
      await task;
    } finally {
      if (activeLoadRef.current === task) activeLoadRef.current = null;
    }
  };

  const refreshComplaints = async () => {
    if (!currentUser) return;
    const { data: { session } } = await createClient().auth.getSession();
    if (!session?.access_token || session.user.id !== currentUser.id) {
      setSyncError("Your session expired. Sign in again to refresh complaints.");
      setSyncState("error");
      return;
    }
    await loadComplaints(currentUser, session.access_token);
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
          setReadNotificationIds(new Set());
          return;
        }

        const user = await buildProfileFromUser(session.user);
        setCurrentUser(user);
        if (session.access_token) {
          await loadComplaints(user, session.access_token);
        }
      } catch (error) {
        setComplaints([]);
        setSyncError(error instanceof Error ? error.message : "Could not load complaints.");
        setSyncState("error");
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
        setReadNotificationIds(new Set());
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        try {
          const user = await buildProfileFromUser(session.user);
          setCurrentUser(user);
          await loadComplaints(user, session.access_token);
        } catch (error) {
          setComplaints([]);
          setSyncError(error instanceof Error ? error.message : "Could not load complaints.");
          setSyncState("error");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keep dashboards in sync when complaints change. Realtime provides quick
  // updates; polling and focus refresh cover dropped events or disabled realtime.
  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    let removeChannel: (() => void) | undefined;
    let eventTimer: number | undefined;
    const refresh = async () => {
      try {
        if (!cancelled) await refreshComplaints();
      } catch {
        // The visible sync state includes the error; the next poll retries.
      }
    };
    const scheduleRefresh = () => {
      if (eventTimer) window.clearTimeout(eventTimer);
      eventTimer = window.setTimeout(() => { void refresh(); }, 250);
    };
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);

    const connect = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.access_token) return;
      const channel = supabase.channel(`user-issues-${currentUser.id}`);
      const filter = currentUser.role === "student"
        ? { filter: `reporter_id=eq.${currentUser.id}` }
        : isAuthorityRole(currentUser.role) && currentUser.authorityScope !== "all_departments"
          ? { filter: `assigned_department=eq.${backendDepartment(currentUser.department || "")}` }
          : {};
      channel
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "issues",
          ...filter,
        }, () => {
          scheduleRefresh();
        })
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "issue_updates",
        }, scheduleRefresh)
        .subscribe((status) => {
          const connected = status === "SUBSCRIBED";
          syncTransportRef.current = connected ? "realtime" : "polling";
          setSyncState((current) => current === "error" || current === "syncing"
            ? current
            : connected ? "realtime" : "polling");
        });
      removeChannel = () => { void supabase.removeChannel(channel); };
    };
    void connect();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(refreshInterval);
      if (eventTimer) window.clearTimeout(eventTimer);
      removeChannel?.();
    };
  }, [currentUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.READ_NOTIFICATIONS);
        const values: unknown = raw ? JSON.parse(raw) : [];
        setReadNotificationIds(new Set(Array.isArray(values) ? values.filter((id): id is string => typeof id === "string") : []));
      } catch {
        setReadNotificationIds(new Set());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notifications = useMemo(() => deriveNotifications(complaints, readNotificationIds), [complaints, readNotificationIds]);

  const persistReadNotificationIds = (ids: Set<string>) => {
    setReadNotificationIds(ids);
    try {
      localStorage.setItem(STORAGE_KEYS.READ_NOTIFICATIONS, JSON.stringify([...ids]));
    } catch {
      // Read markers are a local UI preference; notifications themselves derive from database records.
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
      const expectedRole = role;
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
          setReadNotificationIds(new Set());
    return { success: true };
  };

  const submitComplaint = async (data: {
    title: string;
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
        location: `${data.campusLocation} - ${data.specificLocation}`,
      }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    const payload = (await response.json()) as {
      issue: DatabaseIssue;
      analysis?: {
        available: boolean;
        category: AIComplaintCategory;
        categoryConfidence: number;
        summary: string | null;
        priority: Priority;
        priorityScore: number;
        reason: string | null;
        affectedPopulation: number | null;
        spam: boolean | null;
        spamReason: string | null;
      };
      similarities?: Array<{ similar_issue_id: string; related_category: string; similarity: number; same_category: boolean }>;
    };
    const created = mapDatabaseIssue(payload.issue, currentUser);
    if (payload.analysis) {
      created.priority = payload.analysis.priority;
      created.priorityScore = payload.analysis.priorityScore;
      created.aiCategory = payload.analysis.category;
      created.aiSummary = payload.analysis.summary ?? undefined;
      created.aiReason = payload.analysis.reason ?? undefined;
      created.aiAvailable = payload.analysis.available;
      created.aiAffectedPopulation = payload.analysis.affectedPopulation ?? undefined;
      created.aiSpam = payload.analysis.spam ?? undefined;
      created.aiSpamReason = payload.analysis.spamReason ?? undefined;
    }
    created.similarComplaints = payload.similarities?.map((match) => ({
      id: match.similar_issue_id,
      category: match.related_category as AIComplaintCategory,
      similarity: match.similarity,
      sameCategory: match.same_category,
    }));
    // Update shared UI immediately from the database's insert response. This
    // keeps the new complaint visible even if the follow-up list request fails.
    setComplaints((previous) => [
      created,
      ...previous.filter((item) => item.id !== created.id),
    ]);
    if (currentUser) {
      try {
        await loadComplaints(currentUser, token);
      } catch (error) {
        console.error("Complaint was saved, but the list refresh failed:", error);
      }
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

  const runStudentComplaintAction = async (id: string, action: "provide_info" | "confirm_resolution" | "reopen", message = "") => {
    if (currentUser?.role !== "student") throw new Error("Only the complaint's student reporter can perform this action.");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || session.user.id !== currentUser.id) throw new Error("Your session has expired. Please sign in again.");
    const { error } = await supabase.rpc("campusfix_student_complaint_action", {
      p_issue_id: id,
      p_action: action,
      p_message: message.trim(),
    });
    if (error) throw new Error(error.message || "Could not save the complaint update.");
    await loadComplaints(currentUser, session.access_token);
  };

  const provideAdditionalInfo = async (id: string, message: string): Promise<void> => {
    await runStudentComplaintAction(id, "provide_info", message);
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

  const updateAIComplaintCategory = async (id: string, category: AIComplaintCategory): Promise<void> => {
    if (currentUser?.role !== "admin") throw new Error("Only administrators can correct complaint classifications.");
    const { data: session } = await createClient().auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`/api/admin/issues/${id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    if (currentUser) await loadComplaints(currentUser, token);
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
    await runStudentComplaintAction(id, "confirm_resolution");
  };

  const reopenComplaint = async (id: string, reason: string): Promise<void> => {
    await runStudentComplaintAction(id, "reopen", reason);
  };

  const markNotificationRead = (id: string) => {
    persistReadNotificationIds(new Set([...readNotificationIds, id]));
  };

  const markAllNotificationsRead = () => {
    persistReadNotificationIds(new Set([...readNotificationIds, ...notifications.map((item) => item.id)]));
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
        syncState,
        syncError,
        refreshComplaints,
        login,
        logout,
        submitComplaint,
        verifyComplaint,
        forwardComplaint,
        requestAdditionalInfo,
        provideAdditionalInfo,
        assignDepartment,
        updatePriority,
        updateAIComplaintCategory,
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
