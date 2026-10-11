import type { Role } from "@/lib/types";

/** Normalize only known persisted roles; never turn an unknown role into student. */
export function normalizeProfileRole(role: unknown): Role | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase();
  if (normalized === "student") return "student";
  if (normalized === "admin") return "admin";
  if (["department_authority", "faculty", "authority"].includes(normalized)) {
    return "department_authority";
  }
  return null;
}

export type ProfileAuthorization =
  | { allowed: true }
  | { allowed: false; reason: "profile_missing" | "profile_mismatch" | "invalid_role" | "role_not_student"; role?: string };

export function authorizeStudentSubmission(
  userId: string,
  profile: { id: string; role: unknown } | null
): ProfileAuthorization {
  if (!profile) return { allowed: false, reason: "profile_missing" };
  if (!userId || profile.id !== userId) return { allowed: false, reason: "profile_mismatch" };
  const role = normalizeProfileRole(profile.role);
  if (!role) return { allowed: false, reason: "invalid_role", role: String(profile.role ?? "") };
  if (role !== "student") return { allowed: false, reason: "role_not_student", role: String(profile.role) };
  return { allowed: true };
}
