import { ComplaintCategory } from "./types";

export type CanonicalDepartment =
  | "Electrical"
  | "Plumbing"
  | "Cleanliness"
  | "Infrastructure"
  | "IT Support"
  | "Equipment"
  | "General Maintenance";

export const DEPARTMENT_DISPLAY_NAMES: Record<CanonicalDepartment, string> = {
  Electrical: "Electrical Maintenance",
  Plumbing: "Plumbing & Water Works",
  Cleanliness: "Cleanliness & Sanitation",
  Infrastructure: "Infrastructure & Civil Maintenance",
  "IT Support": "IT & Network Support",
  Equipment: "Equipment & Laboratory Maintenance",
  "General Maintenance": "General Maintenance",
};

const CATEGORY_TO_DEPARTMENT: Partial<Record<ComplaintCategory, CanonicalDepartment>> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  cleanliness: "Cleanliness",
  infrastructure: "Infrastructure",
  internet: "IT Support",
  equipment: "Equipment",
  other: "General Maintenance",
  // Legacy UI categories retain deterministic routing until the UI is migrated.
  classroom: "Infrastructure",
  maintenance: "Infrastructure",
  network: "IT Support",
  hostel: "General Maintenance",
  safety: "General Maintenance",
};

export function getDepartmentForCategory(
  category: string
): CanonicalDepartment | null {
  return CATEGORY_TO_DEPARTMENT[category as ComplaintCategory] ?? null;
}

export function getDatabaseCategory(category: ComplaintCategory): string {
  if (category === "classroom" || category === "maintenance") return "infrastructure";
  if (category === "network") return "internet";
  if (category === "hostel" || category === "safety") return "other";
  return category;
}

export function getDepartmentDisplayName(department?: string | null): string {
  if (!department) return "Unassigned";
  return DEPARTMENT_DISPLAY_NAMES[department as CanonicalDepartment] || department;
}

export function getCanonicalDepartment(department: string): CanonicalDepartment | null {
  if (department in DEPARTMENT_DISPLAY_NAMES) {
    return department as CanonicalDepartment;
  }

  const match = Object.entries(DEPARTMENT_DISPLAY_NAMES).find(
    ([, displayName]) => displayName === department
  );
  return (match?.[0] as CanonicalDepartment | undefined) || null;
}