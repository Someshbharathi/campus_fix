import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRoutingCategoryForAI, isAIComplaintCategory } from "@/lib/ai/categories";
import { getDepartmentForCategory } from "@/lib/department-routing";
import { getSimilarityThresholds } from "@/lib/ai/embeddings";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Invalid or expired authentication token." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Unable to verify administrator permissions." }, { status: 500 });
  if (profile?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  let body: { category?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 }); }
  if (!isAIComplaintCategory(body.category)) return NextResponse.json({ error: "Choose a configured complaint category." }, { status: 400 });

  const { id } = await context.params;
  const routeCategory = getRoutingCategoryForAI(body.category);
  const assignedDepartment = getDepartmentForCategory(routeCategory);
  if (!assignedDepartment) return NextResponse.json({ error: "The selected category has no department route." }, { status: 400 });

  const { data: issue, error } = await supabase.from("issues").update({
    ai_category: body.category,
    ai_category_reviewed_by: user.id,
    ai_category_reviewed_at: new Date().toISOString(),
    category: routeCategory,
    assigned_department: assignedDepartment,
    routing_exception: false,
  }).eq("id", id).select("*").maybeSingle();

  if (error) {
    console.error("Admin category correction failed:", { issueId: id, code: error.code, message: error.message });
    return NextResponse.json({ error: "Unable to update complaint classification." }, { status: 500 });
  }
  if (!issue) return NextResponse.json({ error: "Complaint not found." }, { status: 404 });

  const serviceClient = createServiceClient();
  if (serviceClient) {
    const thresholds = getSimilarityThresholds();
    const { error: similarityError } = await serviceClient.rpc("campusfix_link_similar_issues", {
      p_issue_id: id,
      p_same_category_threshold: thresholds.sameCategory,
      p_cross_category_threshold: thresholds.crossCategory,
      p_limit: 5,
    });
    if (similarityError) console.warn("Could not refresh similarity links after category correction:", similarityError.message);
  }
  return NextResponse.json({ issue });
}
