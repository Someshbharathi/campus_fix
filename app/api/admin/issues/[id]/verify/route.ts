
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const allowedDecisions = [
  "approved",
  "rejected",
  "needs_clarification",
  "sensitive_review",
] as const;

type VerificationDecision = (typeof allowedDecisions)[number];

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

    // Require a logged-in user.
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

    // Verify the token with Supabase.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonError("Invalid or expired login session.", 401);
    }

    // Verify the user's role using their own profile.
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
      return jsonError("Only administrators can review complaints.", 403);
    }

    const { id } = await params;

    if (!id) {
      return jsonError("Complaint ID is required.", 400);
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("decision" in body)
    ) {
      return jsonError("A verification decision is required.", 400);
    }

    const { decision, note } = body as {
      decision: unknown;
      note?: unknown;
    };

    if (
      typeof decision !== "string" ||
      !allowedDecisions.includes(decision as VerificationDecision)
    ) {
      return jsonError("Invalid verification decision.", 400);
    }

    if (note !== undefined && typeof note !== "string") {
      return jsonError("The review note must be text.", 400);
    }

    const reviewNote = typeof note === "string" ? note.trim() : "";

    if (reviewNote.length > 2000) {
      return jsonError("The review note must be 2000 characters or fewer.", 400);
    }

    if (
      ["rejected", "needs_clarification", "sensitive_review"].includes(
        decision
      ) &&
      !reviewNote
    ) {
      return jsonError("Please provide a reason for this decision.", 400);
    }

    // Ensure the complaint exists and is awaiting review.
    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .select("id, verification_status")
      .eq("id", id)
      .maybeSingle();

    if (issueError) {
      console.error("Issue lookup failed:", issueError.message);
      return jsonError("Unable to retrieve the complaint.", 500);
    }

    if (!issue) {
      return jsonError("Complaint not found or access denied.", 404);
    }

    const reviewableStates = ["pending", "sensitive_review"];
    if (!reviewableStates.includes(issue.verification_status)) {
      return jsonError("This complaint has already been reviewed.", 409);
    }

    // Save the admin's decision.
    const { data: updatedIssue, error: updateError } = await supabase
      .from("issues")
      .update({
        verification_status: decision,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        verification_note: reviewNote || null,
      })
      .eq("id", id)
      .eq("verification_status", issue.verification_status)
      .select(
        "id, title, verification_status, verified_by, verified_at, verification_note"
      )
      .maybeSingle();

    if (updateError) {
      console.error("Verification update failed:", updateError.message);
      return jsonError(
        "Could not save the decision. Check the database permissions.",
        500
      );
    }

    if (!updatedIssue) {
      return jsonError(
        "The complaint was already reviewed or the update was blocked by database permissions.",
        409
      );
    }

    return NextResponse.json({
      message: "Complaint review saved successfully.",
      issue: updatedIssue,
    });
  } catch (error) {
    console.error("Verification API error:", error);

    return jsonError("Invalid request or unexpected server error.", 500);
  }
}
