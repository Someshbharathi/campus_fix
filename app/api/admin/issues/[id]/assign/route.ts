
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const allowedDepartments = [
  "Electrical",
  "Plumbing",
  "Cleanliness",
  "Infrastructure",
  "IT Support",
  "Equipment",
  "General Maintenance",
] as const;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return jsonError("Supabase configuration is missing.", 500);
    }

    // Authenticate the user.
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

    // Check the user's role.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return jsonError("Unable to verify user permissions.", 500);
    }

    if (profile?.role !== "admin") {
      return jsonError("Only administrators can assign complaints.", 403);
    }

    const { id } = await params;

    if (!id) {
      return jsonError("Complaint ID is required.", 400);
    }

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || !("department" in body)) {
      return jsonError("A department is required.", 400);
    }

    const { department } = body as { department: unknown };

    if (
      typeof department !== "string" ||
      !allowedDepartments.includes(
        department as (typeof allowedDepartments)[number]
      )
    ) {
      return jsonError(
        `Invalid department. Allowed departments: ${allowedDepartments.join(", ")}.`,
        400
      );
    }

    // Routed complaints may be reassigned without forcing administrator
    // verification. Rejected, clarification, and sensitive-review items stay out.
    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .select("id, verification_status, status")
      .eq("id", id)
      .maybeSingle();

    if (issueError) {
      console.error("Issue lookup failed:", issueError.message);
      return jsonError("Unable to retrieve the complaint.", 500);
    }

    if (!issue) {
      return jsonError("Complaint not found or access denied.", 404);
    }

    if (!["pending", "approved"].includes(issue.verification_status)) {
      return jsonError(
        "This complaint is not eligible for department assignment.",
        409
      );
    }

    // Save the assignment.
    const { data: updatedIssue, error: updateError } = await supabase
      .from("issues")
      .update({
        assigned_department: department,
        status: "assigned",
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .in("verification_status", ["pending", "approved"])
      .select(
        "id, title, verification_status, assigned_department, status, updated_at"
      )
      .maybeSingle();

    if (updateError) {
      console.error("Assignment update failed:", updateError.message);
      return jsonError(
        "Could not assign the complaint. Check Supabase RLS permissions.",
        500
      );
    }

    if (!updatedIssue) {
      return jsonError(
        "The assignment was blocked or the complaint is no longer approved.",
        409
      );
    }

    return NextResponse.json({
      message: "Complaint assigned successfully.",
      issue: updatedIssue,
    });
  } catch (error) {
    console.error("Assignment API error:", error);
    return jsonError("Invalid request or unexpected server error.", 500);
  }
}
