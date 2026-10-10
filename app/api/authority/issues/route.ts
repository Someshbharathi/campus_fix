
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return jsonError("Supabase configuration is missing.", 500);
    }

    // Require a valid Supabase access token.
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return jsonError("Authentication required.", 401);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonError("Invalid or expired login session.", 401);
    }

    // Read the department and role from the authenticated user's profile.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, department")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return jsonError("Unable to verify user permissions.", 500);
    }

    if (!profile || profile.role !== "faculty") {
      return jsonError(
        "Only authorized department authorities can access these complaints.",
        403
      );
    }

    if (!profile.department) {
      return jsonError(
        "No department is assigned to your profile. Contact an administrator.",
        403
      );
    }

    // Return approved complaints assigned to this user's department only.
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select(
        "id, title, description, category, location, priority, status, assigned_department, created_at, updated_at"
      )
      .eq("verification_status", "approved")
      .eq("assigned_department", profile.department)
      .in("status", ["assigned", "in_progress", "resolved"])
      .order("created_at", { ascending: false });

    if (issuesError) {
      console.error("Authority issues query failed:", issuesError.message);
      return jsonError(
        "Unable to retrieve department complaints. Check database permissions.",
        500
      );
    }

    return NextResponse.json({
      department: profile.department,
      count: issues.length,
      issues,
    });
  } catch (error) {
    console.error("Authority issues API error:", error);
    return jsonError("Unexpected server error.", 500);
  }
}
