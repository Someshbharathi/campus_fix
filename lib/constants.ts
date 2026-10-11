import { ComplaintCategory, Priority, ResolutionStatus, VerificationStatus } from "./types";

export const CATEGORIES: {
  id: ComplaintCategory;
  label: string;
  department: string;
  description: string;
}[] = [
    {
      id: "electrical",
      label: "Electrical Issues",
      department: "Electrical Maintenance",
      description: "Power outages, faulty wiring, broken switches, unfunctional fans/ACs, lighting issues",
    },
    {
      id: "plumbing",
      label: "Plumbing & Water Supply",
      department: "Plumbing & Water Works",
      description: "Leaking pipes, tap issues, water shortages, bathroom drainage, drinking water coolers",
    },
    {
      id: "cleanliness",
      label: "Cleanliness & Sanitation",
      department: "Cleanliness & Sanitation",
      description: "Trash accumulation, uncleaned restrooms, corridor dust, pest control",
    },
    {
      id: "classroom",
      label: "Classroom & Lab Facilities",
      department: "Infrastructure & Civil Maintenance",
      description: "Projectors, audio systems, broken desks, whiteboard issues, lab equipment",
    },
    {
      id: "hostel",
      label: "Hostel Issues",
      department: "General Maintenance",
      description: "Room maintenance, hot water supply, mess facility, furniture damage",
    },
    {
      id: "network",
      label: "Internet & Network",
      department: "IT & Network Support",
      description: "Wi-Fi connectivity, LAN port malfunction, firewall/portal login problems",
    },
    {
      id: "safety",
      label: "Safety & Security",
      department: "General Maintenance",
      description: "Broken locks, dim streetlights, fire extinguisher inspection, surveillance",
    },
    {
      id: "maintenance",
      label: "Maintenance & Repairs",
      department: "Infrastructure & Civil Maintenance",
      description: "Cracked walls, window glass replacement, door repair, lift maintenance",
    },
    {
      id: "other",
      label: "Other Campus Concerns",
      department: "General Maintenance",
      description: "Any issue not covered in above categories",
    },
  ];

export const DEPARTMENTS = [
  "Electrical Maintenance",
  "Plumbing & Water Works",
  "Cleanliness & Sanitation",
  "Infrastructure & Civil Maintenance",
  "IT & Network Support",
  "Equipment & Laboratory Maintenance",
  "General Maintenance",
];

export const CAMPUS_LOCATIONS = [
  "Academic Block A (Science & Tech)",
  "Academic Block B (Engineering)",
  "Academic Block C (Management & Arts)",
  "Central Library & Information Center",
  "Hostel 1 - Ramanujan Hall",
  "Hostel 2 - Sarabhai Hall",
  "Hostel 3 - Gargi Hall (Girls)",
  "Hostel 4 - Aryabhatta Hall",
  "Student Activity Center & Sports Complex",
  "Campus Dining Hall / Central Mess",
  "Auditorium & Seminar Complex",
  "Administrative Block",
  "Campus Health Center",
];

export const VERIFICATION_STATUS_META: Record<
  VerificationStatus,
  { label: string; badgeClass: string; description: string }
> = {
  awaiting_verification: {
    label: "Awaiting Verification",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
    description: "Under initial inspection by Campus Administration",
  },
  verified: {
    label: "Verified",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
    description: "Confirmed valid and forwarded for resolution",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60",
    description: "Complaint declined during initial screening",
  },
  info_requested: {
    label: "Info Requested",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60",
    description: "Admin requested additional evidence or clarification",
  },
};

export const RESOLUTION_STATUS_META: Record<
  ResolutionStatus,
  { label: string; badgeClass: string; description: string }
> = {
  submitted: {
    label: "Submitted",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    description: "Complaint recorded in the portal",
  },
  awaiting_verification: {
    label: "Awaiting Verification",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
    description: "Pending verification review",
  },
  pending_assignment: {
    label: "Pending Assignment",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60",
    description: "Verified; queued for department assignment",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60",
    description: "Technicians or department staff actively working",
  },
  resolved: {
    label: "Resolved",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
    description: "Issue fixed and verified by department",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60",
    description: "Complaint closed as rejected",
  },
  reopened: {
    label: "Reopened",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60",
    description: "Reopened by student due to recurring fault",
  },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; badgeClass: string; dotClass: string }
> = {
  low: {
    label: "Low",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
  medium: {
    label: "Medium",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60",
    dotClass: "bg-blue-500",
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60",
    dotClass: "bg-orange-500",
  },
  critical: {
    label: "Critical",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60",
    dotClass: "bg-rose-600 animate-pulse",
  },
};
