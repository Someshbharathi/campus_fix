import test from "node:test";
import assert from "node:assert/strict";
import { scorePriority, validateAnalysis } from "../lib/ai/complaint-analysis.ts";
import { getDepartmentForCategory } from "../lib/department-routing.ts";

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

test("Gemini output is validated and priority is calculated server-side", () => {
  const result = validateAnalysis({
    category: "electrical", categoryConfidence: 0.9, safety: 5, severity: 5, urgency: 4, frequency: 2,
    summary: "Exposed wiring near a sink.", reason: "Immediate shock risk.", priority: "low",
  });
  assert.equal(result?.priorityScore, 90);
  assert.equal(result?.priority, "critical");
  assert.equal(validateAnalysis({ category: "unsafe", safety: 9 }), null);
});
