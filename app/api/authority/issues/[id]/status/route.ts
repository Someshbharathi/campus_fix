
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Read and validate the authorization token
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication token is missing." },
        { status: 401 }
      );
    }

    // 2. Create a Supabase client using the user's token
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 3. Verify the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token." },
        { status: 401 }
      );
    }

    // 4. Read the complaint ID and request body
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Complaint ID is required." },
        { status: 400 }
      );
    }

    let body: { status?: unknown; comment?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }

    const { status, comment } = body;

    if (status !== "in_progress" && status !== "resolved") {
      return NextResponse.json(
        {
          error: "Invalid status. Allowed values: in_progress, resolved.",
        },
        { status: 400 }
      );
    }

    if (typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json(
        { error: "A comment is required." },
        { status: 400 }
      );
    }

    if (comment.length > 2000) {
      return NextResponse.json(
        { error: "Comment must not exceed 2000 characters." },
        { status: 400 }
      );
    }

    // 5. Atomically update the complaint and insert its history
    const { data, error } = await supabase.rpc(
      "update_issue_status_atomic",
      {
        p_issue_id: id,
        p_new_status: status,
        p_comment: comment.trim(),
      }
    );

    if (error) {
      console.error("Atomic status update failed:", error.message);

      // Known business-rule rejections should not be server errors.
      const expectedErrors = [
        "Invalid status transition",
        "Complaint not found or access denied",
        "Invalid target status",
        "A comment is required",
        "Comment is too long",
        "Department authority access required",
        "Authentication required",
      ];

      const expectedError = expectedErrors.find((message) =>
        error.message.includes(message)
      );

      if (expectedError) {
        const statusCode =
          expectedError === "Authentication required" ? 401 : 400;

        return NextResponse.json(
          { error: error.message },
          { status: statusCode }
        );
      }

      // Unexpected database/RLS/function errors remain server errors.
      return NextResponse.json(
        { error: "Status update failed. Check the server logs." },
        { status: 500 }
      );
    }

    // 6. Return the result from the atomic database function
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Authority status API error:", error);

    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
