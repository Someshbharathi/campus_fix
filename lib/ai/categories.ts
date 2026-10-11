import type { ComplaintCategory } from "@/lib/types";

export const AI_CATEGORY_OPTIONS = [
  { id: "electrical", label: "Electrical", routingCategory: "electrical" },
  { id: "plumbing_water_supply", label: "Plumbing and Water Supply", routingCategory: "plumbing" },
  { id: "internet_wifi", label: "Internet and Wi-Fi", routingCategory: "internet" },
  { id: "classroom_lab_equipment", label: "Classroom and Laboratory Equipment", routingCategory: "equipment" },
  { id: "furniture_infrastructure", label: "Furniture and Infrastructure", routingCategory: "infrastructure" },
  { id: "cleanliness_sanitation", label: "Cleanliness and Sanitation", routingCategory: "cleanliness" },
  { id: "hostel_facilities", label: "Hostel Facilities", routingCategory: "other" },
  { id: "canteen_food_services", label: "Canteen and Food Services", routingCategory: "other" },
  { id: "security_safety", label: "Security and Safety", routingCategory: "other" },
  { id: "transportation", label: "Transportation", routingCategory: "other" },
  { id: "administrative_services", label: "Administrative Services", routingCategory: "other" },
  { id: "other", label: "Other", routingCategory: "other" },
] as const satisfies readonly { id: string; label: string; routingCategory: ComplaintCategory }[];

export type AIComplaintCategory = (typeof AI_CATEGORY_OPTIONS)[number]["id"];

export function isAIComplaintCategory(value: unknown): value is AIComplaintCategory {
  return typeof value === "string" && AI_CATEGORY_OPTIONS.some((option) => option.id === value);
}

export function getAIComplaintCategoryLabel(value?: string | null): string {
  return AI_CATEGORY_OPTIONS.find((option) => option.id === value)?.label ?? "Other";
}

export function getRoutingCategoryForAI(value: AIComplaintCategory): ComplaintCategory {
  return AI_CATEGORY_OPTIONS.find((option) => option.id === value)?.routingCategory ?? "other";
}

export function inferAIComplaintCategory(text: string): AIComplaintCategory {
  const value = text.toLowerCase();
  const rules: Array<[AIComplaintCategory, RegExp]> = [
    ["security_safety", /\b(security|unsafe|safety|fire|smoke|gas leak|accident|threat|emergency|exposed wire)\b/],
    ["internet_wifi", /\b(internet|wi[ -]?fi|wifi|network|lan|router|connectivity)\b/],
    ["plumbing_water_supply", /\b(water|tap|pipe|plumb|drain|leak|cooler|faucet|toilet|flush)\b/],
    ["electrical", /\b(electric|power|wiring|wire|socket|switch|light|fan|ac|outage)\b/],
    ["cleanliness_sanitation", /\b(clean|cleanliness|sanitation|garbage|trash|waste|pest|dirty|litter)\b/],
    ["hostel_facilities", /\b(hostel|dorm|residence hall|residential)\b/],
    ["canteen_food_services", /\b(canteen|cafeteria|food|mess|meal|kitchen)\b/],
    ["transportation", /\b(bus|shuttle|transport|vehicle|parking|road)\b/],
    ["administrative_services", /\b(admin|administrative|registration|records|office|document)\b/],
    ["classroom_lab_equipment", /\b(lab|laboratory|projector|computer|equipment|microscope|printer|classroom)\b/],
    ["furniture_infrastructure", /\b(furniture|chair|desk|table|building|wall|ceiling|floor|door|window|roof|infrastructure)\b/],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] ?? "other";
}
