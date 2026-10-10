export type Role = "student" | "admin" | "authority";

export type VerificationStatus =
  | "awaiting_verification"
  | "verified"
  | "rejected"
  | "info_requested";

export type ResolutionStatus =
  | "submitted"
  | "awaiting_verification"
  | "pending_assignment"
  | "in_progress"
  | "resolved"
  | "rejected"
  | "reopened";

export type Priority = "low" | "medium" | "high" | "critical";

export type ComplaintCategory =
  | "electrical"
  | "plumbing"
  | "cleanliness"
  | "classroom"
  | "hostel"
  | "network"
  | "safety"
  | "maintenance"
  | "other";

export interface CategoryInfo {
  id: ComplaintCategory;
  label: string;
  iconName: string;
  defaultDepartment: string;
  description: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  actor: string;
  type:
    | "created"
    | "verified"
    | "rejected"
    | "assigned"
    | "progress"
    | "info_requested"
    | "info_provided"
    | "resolved"
    | "reopened";
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  campusLocation: string;
  specificLocation: string;
  evidenceUrl?: string;
  evidenceName?: string;
  verificationStatus: VerificationStatus;
  verificationReason?: string;
  verificationDate?: string;
  resolutionStatus: ResolutionStatus;
  priority: Priority;
  assignedDepartment?: string;
  assignedPerson?: string;
  submittedBy: {
    id: string;
    name: string;
    email: string;
    rollNumber?: string;
    phone?: string;
  };
  submittedAt: string;
  updatedAt: string;
  resolutionNotes?: string;
  resolutionProofUrl?: string;
  resolutionProofName?: string;
  resolvedAt?: string;
  additionalInfoRequested?: string;
  additionalInfoProvided?: string;
  isOverdue?: boolean;
  timeline: TimelineEvent[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  rollNumber?: string;
  department?: string;
  avatar?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  complaintId?: string;
  type: "verification" | "assignment" | "status" | "info";
}
