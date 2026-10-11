import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isCriticalSafetyReport, scorePriority, validateAnalysis } from "../lib/ai/complaint-analysis.ts";
import { getDepartmentForCategory } from "../lib/department-routing.ts";
import { AI_CATEGORY_OPTIONS, getRoutingCategoryForAI, inferAIComplaintCategory, isAIComplaintCategory } from "../lib/ai/categories.ts";
import { authorizeStudentSubmission, normalizeProfileRole } from "../lib/auth/roles.ts";

test("all canonical categories route to the shared department mapping", () => {
  assert.deepEqual(
    Object.fromEntries([
      "electrical", "plumbing", "cleanliness", "infrastructure", "internet", "equipment", "other",
    ].map((category) => [category, getDepartmentForCategory(category)])),
    {
      electrical: "Electrical",
      plumbing: "Plumbing",
      cleanliness: "Cleanliness",
      infrastructure: "Infrastructure",
      internet: "IT Support",
      equipment: "Equipment",
      other: "General Maintenance",
    },
  );
  assert.equal(getDepartmentForCategory("invalid"), null);
});

test("priority scoring applies the requested weighted thresholds", () => {
  assert.deepEqual(scorePriority(0, 0, 0, 0), { score: 0, priority: "low" });
  assert.deepEqual(scorePriority(1, 2, 2, 1), { score: 30, priority: "medium" });
  assert.deepEqual(scorePriority(5, 2, 2, 1), { score: 62, priority: "high" });
  assert.deepEqual(scorePriority(5, 5, 5, 5), { score: 100, priority: "critical" });
});

test("obvious immediate hazards always trigger deterministic critical handling", () => {
  assert.equal(isCriticalSafetyReport("Smoke in the lab", "Smoke is filling the room"), true);
  assert.equal(isCriticalSafetyReport("Unsafe condition", "An exposed wire is sparking"), true);
  assert.equal(isCriticalSafetyReport("Broken chair", "One leg is loose in the classroom"), false);
});

test("similarity SQL indexes cosine vectors with the declared generate_subscripts alias", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261014_ai_category_similarity.sql", import.meta.url), "utf8");
  assert.match(sql, /FROM generate_subscripts\(e\.embedding, 1\) AS dimension\(index\)/);
  assert.match(sql, /e\.embedding\[dimension\.index\].*v_embedding\[dimension\.index\]/s);
  assert.doesNotMatch(sql, /embedding\[pos\]/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.campusfix_store_issue_embedding\([^;]+ TO service_role;/s);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
});

test("Gemini output is validated and priority is calculated server-side", () => {
  const result = validateAnalysis({
    category: "electrical", categoryConfidence: 0.9, safety: 5, severity: 5, urgency: 4, frequency: 2,
    summary: "Exposed wiring near a sink.", reason: "Immediate shock risk.", priority: "low",
  });
  assert.equal(result?.priorityScore, 90);
  assert.equal(result?.priority, "critical");
  assert.equal(validateAnalysis({ category: "unsafe", safety: 9 }), null);
});

test("configured AI categories are stable and map to existing routing buckets", () => {
  assert.equal(AI_CATEGORY_OPTIONS.length, 12);
  assert.equal(new Set(AI_CATEGORY_OPTIONS.map(({ id }) => id)).size, 12);
  for (const { id } of AI_CATEGORY_OPTIONS) {
    assert.equal(isAIComplaintCategory(id), true);
    assert.ok(getDepartmentForCategory(getRoutingCategoryForAI(id)));
  }
  assert.equal(inferAIComplaintCategory("The water cooler near the library is broken."), "plumbing_water_supply");
  assert.equal(inferAIComplaintCategory("Projector in room 204 is not working."), "classroom_lab_equipment");
  assert.equal(inferAIComplaintCategory("Something unusual happened."), "other");
});

test("submission authorization trusts only a matching database student profile", () => {
  const studentProfile = { id: "student-user", role: "student" };
  assert.deepEqual(authorizeStudentSubmission("student-user", studentProfile), { allowed: true });
  // Separate requests by the same authorized student remain authorized; the
  // route creates a fresh issue row for each request.
  assert.deepEqual(authorizeStudentSubmission("student-user", studentProfile), { allowed: true });
  assert.equal(authorizeStudentSubmission("admin-user", { id: "admin-user", role: "admin" }).allowed, false);
  assert.equal(authorizeStudentSubmission("authority-user", { id: "authority-user", role: "department_authority" }).allowed, false);
  assert.equal(authorizeStudentSubmission("faculty-user", { id: "faculty-user", role: "faculty" }).allowed, false);
  assert.deepEqual(authorizeStudentSubmission("missing-user", null), { allowed: false, reason: "profile_missing" });
  assert.deepEqual(authorizeStudentSubmission("student-user", { id: "other-user", role: "student" }), { allowed: false, reason: "profile_mismatch" });
  assert.equal(normalizeProfileRole("legacy-unknown"), null);
  assert.equal(normalizeProfileRole("authority"), "department_authority");
});
