import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "campusfix-complaint-media";

function safeMessage(value: unknown): string {
  if (typeof value !== "string") return "Resumable Storage upload failed.";
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted token]")
    .replace(/("?(?:token|access_token|authorization|signature)"?\s*:\s*")[^"]+("?)/gi, "$1[redacted]$2")
    .replace(/([?&](?:token|signature|x-signature)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 500);
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
  }
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Unable to verify account permissions." }, { status: 500 });
  if (profile?.role !== "student") return NextResponse.json({ error: "Student access required." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid diagnostic payload." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid diagnostic payload." }, { status: 400 });
  }

  const fileSize = body.fileSize;
  if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "Invalid diagnostic file size." }, { status: 400 });
  }
  const status = typeof body.status === "number" && Number.isInteger(body.status) ? body.status : null;
  const statusCode = typeof body.statusCode === "string" && /^\d{3}$/.test(body.statusCode) ? body.statusCode : null;
  const name = typeof body.name === "string" ? body.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) : "UploadError";

  console.error("[issues:create] resumable attachment upload failed", {
    userId: user.id,
    name,
    status,
    statusCode,
    message: safeMessage(body.message),
    bucket: MEDIA_BUCKET,
    fileSize,
  });
  return NextResponse.json({ success: true });
}
