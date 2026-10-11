import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!url || !key) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Invalid or expired login session." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  let body: { status?: unknown; comment?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (body.status !== "in_progress" && body.status !== "resolved") return NextResponse.json({ error: "Invalid status transition target." }, { status: 400 });
  if (typeof body.comment !== "string" || !body.comment.trim() || body.comment.length > 2000) return NextResponse.json({ error: "A comment of 1–2000 characters is required." }, { status: 400 });
  const { id } = await params;
  const { data, error } = await supabase.rpc("update_issue_status_atomic", {
    p_issue_id: id,
    p_new_status: body.status,
    p_comment: body.comment.trim(),
    p_actor_id: user.id,
  });
  if (error) {
    console.error("Admin atomic status update failed:", error.message);
    return NextResponse.json({ error: error.message || "Status update failed." }, { status: 400 });
  }
  return NextResponse.json(data);
}
