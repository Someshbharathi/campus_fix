
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let stage = "request validation";

  try {
    // 1. Read and validate the authorization token
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("Authority status request missing bearer token.");
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      console.warn("Authority status request received an empty bearer token.");
      return NextResponse.json(
        { error: "Authentication token is missing." },
        { status: 401 }
      );
    }

    // 2. Use a normal client to validate the bearer token. Supabase clients
    // configured with accessToken cannot call supabase.auth.getUser().
    const authClient = createClient(supabaseUrl, supabaseKey, {
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
    stage = "token validation";
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      console.warn("Authority status token validation failed.", {
        code: authError?.code,
        message: authError?.message,
      });
      return NextResponse.json(
        { error: "Invalid or expired authentication token." },
        { status: 401 }
      );
    }

    // Use a separate client for database queries/RPC so auth.uid() receives
    // this request's JWT while token validation remains available above.
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      accessToken: async () => token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    stage = "profile lookup";
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, department")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Authority status profile lookup failed.", {
        userId: user.id,
        code: profileError.code,
        message: profileError.message,
      });
      return NextResponse.json(
        { error: "Unable to verify department authority permissions." },
        { status: 500 }
      );
    }

    if (
      !profile ||
      profile.role !== "department_authority" ||
      !profile.department
    ) {
      console.warn("Authority status profile mismatch.", {
        userId: user.id,
        role: profile?.role ?? null,
        hasDepartment: Boolean(profile?.department),
      });
      return NextResponse.json(
        { error: "Department authority access required." },
        { status: 403 }
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

    // Defense in depth around the RPC: only a non-rejected routed issue in this
    // authority's own department may enter the status transition function.
    stage = "issue authorization";
    const { data: issue, error: issueLookupError } = await supabase
      .from("issues")
      .select("id, status, verification_status, assigned_department")
      .eq("id", id)
      .eq("assigned_department", profile.department)
      .in("verification_status", ["pending", "approved"])
      .maybeSingle();

    if (issueLookupError) {
      console.error("Authority issue authorization lookup failed.", {
        issueId: id,
        code: issueLookupError.code,
        message: issueLookupError.message,
      });
      return NextResponse.json(
        { error: "Unable to verify the assigned complaint." },
        { status: 500 }
      );
    }
    if (!issue) {
      return NextResponse.json(
        { error: "Complaint not found, not approved, or assigned to another department." },
        { status: 404 }
      );
    }

    // 5. Atomically update the complaint and insert its history
    stage = "atomic status RPC";
    const { data, error } = await supabase.rpc(
      "update_issue_status_atomic",
      {
        p_issue_id: id,
        p_new_status: status,
        p_comment: comment.trim(),
        p_actor_id: user.id,
      }
    );

    if (error) {
      console.error("Atomic status update failed.", {
        userId: user.id,
        issueId: id,
        requestedStatus: status,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      // Known business-rule rejections should not be server errors.
      const expectedErrors = [
        "Invalid status transition",
        "Complaint not found or access denied",
        "Invalid target status",
        "A comment is required",
        "Comment is too long",
        "Department authority access required",
        "Complaint is not eligible for department work",
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
    const diagnostic = error instanceof Error ? error.message : "Unknown server error";
    console.error("Authority status API error.", {
      stage,
      message: diagnostic,
    });

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Authority status failed during ${stage}: ${diagnostic}`
            : "An unexpected server error occurred.",
      },
      { status: 500 }
    );
  }
}
