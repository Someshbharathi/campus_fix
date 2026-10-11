import type { ComplaintCategory } from "./types";

export type CanonicalDepartment =
  | "Electrical"
  | "Plumbing"
  | "Cleanliness"
  | "Infrastructure"
  | "IT Support"
  | "Equipment"
  | "General Maintenance";

export const DEPARTMENT_OPTIONS = [
  { canonical: "Electrical", label: "Electrical Maintenance" },
  { canonical: "Plumbing", label: "Plumbing & Water Works" },
  { canonical: "Cleanliness", label: "Cleanliness & Sanitation" },
  { canonical: "Infrastructure", label: "Infrastructure & Civil Maintenance" },
  { canonical: "IT Support", label: "IT & Network Support" },
  { canonical: "Equipment", label: "Equipment & Laboratory Maintenance" },
  { canonical: "General Maintenance", label: "General Maintenance" },
] as const satisfies readonly { canonical: CanonicalDepartment; label: string }[];

export type AuthorityScope = "all_departments" | "assigned_department";

export const DEPARTMENT_DISPLAY_NAMES = Object.fromEntries(
  DEPARTMENT_OPTIONS.map(({ canonical, label }) => [canonical, label])
) as Record<CanonicalDepartment, string>;

const CATEGORY_TO_DEPARTMENT: Partial<Record<ComplaintCategory, CanonicalDepartment>> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  cleanliness: "Cleanliness",
  infrastructure: "Infrastructure",
  internet: "IT Support",
  equipment: "Equipment",
  other: "General Maintenance",
  // Legacy UI categories are normalized before this lookup.
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
