import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const priorities = ["low", "medium", "high", "critical"] as const;

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

  let body: { priority?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (typeof body.priority !== "string" || !priorities.includes(body.priority as (typeof priorities)[number])) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }
  const { id } = await params;
  let { data: issue, error } = await supabase.from("issues")
    .update({ priority: body.priority, priority_level: body.priority, updated_at: new Date().toISOString() })
    .eq("id", id).select("id, priority, updated_at").maybeSingle();
  if (error && /column .* does not exist|schema cache/i.test(error.message)) {
    ({ data: issue, error } = await supabase.from("issues")
      .update({ priority: body.priority, updated_at: new Date().toISOString() })
      .eq("id", id).select("id, priority, updated_at").maybeSingle());
  }
  if (error) {
    console.error("Admin priority update failed:", error.message);
    return NextResponse.json({ error: "Could not save the priority override." }, { status: 500 });
  }
  if (!issue) return NextResponse.json({ error: "Complaint not found or access denied." }, { status: 404 });
  return NextResponse.json({ issue });
}
