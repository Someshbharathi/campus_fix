
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDepartmentForCategory } from "@/lib/department-routing";
import { analyzeComplaint, scorePriority } from "@/lib/ai/complaint-analysis";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const allowedCategories = [
  "electrical",
  "plumbing",
  "cleanliness",
  "infrastructure",
  "internet",
  "equipment",
  "other",
] as const;

function jsonError(
  message: string,
  status: number,
  details?: string,
  code?: string,
  stage?: string,
  metadata?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
      ...(code ? { code } : {}),
      ...(stage ? { stage } : {}),
      ...(metadata ? { metadata } : {}),
    },
    { status }
  );
}

function getSupabaseClient(token: string) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function authenticate(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return {
      client: null,
      user: null,
      response: jsonError(
        "Missing Bearer token. Please sign in first.",
        401
      ),
    };
  }

  const token = header.slice(7).trim();

  if (!token) {
    return {
      client: null,
      user: null,
      response: jsonError("Authentication token is empty.", 401),
    };
  }

  try {
    const client = getSupabaseClient(token);

    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      return {
        client: null,
        user: null,
        response: jsonError(
          "Invalid or expired authentication token.",
          401,
          error?.message
        ),
      };
    }

    return { client, user, response: null };
  } catch (error) {
    console.error("Authentication setup failed:", error);

    return {
      client: null,
      user: null,
      response: jsonError(
        "Could not initialize Supabase.",
        500
      ),
    };
  }
}

// GET /api/issues
// Returns issues allowed by the user's RLS policies.
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);

    if (auth.response || !auth.client || !auth.user) {
      return auth.response!;
    }

    const { data: profile, error: profileError } = await auth.client
      .from("profiles")
      .select("role, department")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError || !profile) return jsonError("Unable to verify user permissions.", 403);

    let query = auth.client.from("issues").select("*");
    if (profile.role === "student") query = query.eq("reporter_id", auth.user.id);
    else if (profile.role === "department_authority") {
      if (!profile.department) return jsonError("No department is assigned to this profile.", 403);
      query = query.eq("assigned_department", profile.department)
        .in("verification_status", ["pending", "approved"]);
    } else if (profile.role !== "admin") {
      return jsonError("This account role cannot view complaints.", 403);
    }
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Issue retrieval failed:", error);

      return jsonError(
        "Could not retrieve issues.",
        500,
        error.message,
        error.code
      );
    }

    const issueIds = (data || []).map((issue) => issue.id);
    const { data: history } = issueIds.length
      ? await auth.client.from("campusfix_issue_status_history").select("*").in("issue_id", issueIds).order("created_at", { ascending: true })
      : { data: [] };
    const historyByIssue = new Map<string, typeof history>();
    for (const event of history || []) {
      historyByIssue.set(event.issue_id, [...(historyByIssue.get(event.issue_id) || []), event]);
    }
    return NextResponse.json({
      issues: (data || []).map((issue) => ({ ...issue, status_history: historyByIssue.get(issue.id) || [] })),
    }, { status: 200 });
  } catch (error) {
    console.error("GET issues failed:", error);

    return jsonError("Unexpected server error.", 500);
  }
}

// POST /api/issues
// Creates an issue for the authenticated user.
export async function POST(request: NextRequest) {
  let stage = "authentication";
  try {
    // 1. Authenticate the user.
    const auth = await authenticate(request);

    if (auth.response || !auth.client || !auth.user) {
      return auth.response!;
    }

    const supabase = auth.client;
    const user = auth.user;
    stage = "request_parsing";

    // 2. Parse the request.
    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return jsonError("Request body must be a JSON object.", 400);
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return jsonError("Request body must contain valid JSON.", 400);
    }

    console.info("[issues:create] request received", {
      userId: user.id,
      fields: Object.keys(body),
      titleLength: typeof body.title === "string" ? body.title.trim().length : null,
      descriptionLength: typeof body.description === "string" ? body.description.trim().length : null,
      locationLength: typeof body.location === "string" ? body.location.trim().length : null,
      category: typeof body.category === "string" ? body.category : null,
      evidenceProvided: typeof body.evidenceName === "string" || typeof body.evidenceUrl === "string",
      priorityProvidedByClient: body.priority !== undefined,
    });

    // 3. Validate fields.
    stage = "validation";
    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const location =
      typeof body.location === "string"
        ? body.location.trim()
        : "";

    const requestedCategory =
      typeof body.category === "string" ? body.category.trim().toLowerCase() : "";
    const categoryIsValid = allowedCategories.includes(
      requestedCategory as (typeof allowedCategories)[number]
    );
    // Keep the DB enum/check constraint compatible while routing invalid or
    // missing categories to the administrator exception queue (no department).
    let category = categoryIsValid ? requestedCategory : "other";

    if (title.length < 3 || title.length > 150) {
      return jsonError(
        "Title must be between 3 and 150 characters.",
        400
      );
    }

    if (
      description.length < 5 ||
      description.length > 5000
    ) {
      return jsonError(
        "Description must be between 5 and 5000 characters.",
        400
      );
    }

    if (!location || location.length > 200) {
      return jsonError(
        "Location is required and must not exceed 200 characters.",
        400
      );
    }

    const criticalSafetyReport = /\b(fire|smoke|gas leak|electrocution|live wire|exposed wire|structural collapse|ceiling collapse|severe flooding|chemical spill)\b/i.test(
      `${title} ${description}`
    );

    // 4. Look up the user's profile.
    stage = "profile_lookup";
    const { data: profile, error: profileLookupError } =
      await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileLookupError) {
      console.error("[issues:create] profile lookup failed", {
        userId: user.id,
        code: profileLookupError.code,
        message: profileLookupError.message,
        details: profileLookupError.details,
        hint: profileLookupError.hint,
      });

      return jsonError(
        "Could not look up the user profile.",
        500,
        profileLookupError.message,
        profileLookupError.code,
        stage,
        { userId: user.id, rlsDenied: profileLookupError.code === "42501" }
      );
    }

    if (profile && profile.role !== "student") {
      return jsonError("Only student accounts can submit complaints.", 403, undefined, undefined, "authorization", { userId: user.id, role: profile.role });
    }
    console.info("[issues:create] authenticated profile", {
      userId: user.id,
      reporterId: profile?.id ?? user.id,
      role: profile?.role ?? "profile_missing",
      profileFound: Boolean(profile),
      authUserMatchesProfile: !profile || profile.id === user.id,
    });

    // 5. Create a student profile if one does not exist.
    if (!profile) {
      stage = "profile_creation";
      const fullName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : "Campus User";

      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          full_name: fullName,
          role: "student",
        });

      if (profileInsertError) {
        console.error("[issues:create] profile creation failed", {
          userId: user.id,
          code: profileInsertError.code,
          message: profileInsertError.message,
          details: profileInsertError.details,
          hint: profileInsertError.hint,
          rlsDenied: profileInsertError.code === "42501",
        });

        return jsonError(
          "Could not create the user profile.",
          500,
          profileInsertError.message,
          profileInsertError.code,
          stage,
          { userId: user.id, rlsDenied: profileInsertError.code === "42501" }
        );
      }
    }

    stage = "ai_analysis";
    console.info("[issues:create] Gemini configuration", { apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY) });
    const analysis = await analyzeComplaint({ title, description, location, category });
    // Use the model's category only when the student supplied a valid category
    // and Gemini reports strong confidence. Invalid input remains an exception.
    if (categoryIsValid && analysis && analysis.categoryConfidence >= 0.75) {
      category = analysis.category;
    }
    const assignedDepartment = categoryIsValid ? getDepartmentForCategory(category) : null;
    const priorityFactors = {
      safety: criticalSafetyReport ? 5 : analysis?.safety ?? 1,
      severity: criticalSafetyReport ? 5 : analysis?.severity ?? 2,
      urgency: criticalSafetyReport ? 5 : analysis?.urgency ?? 2,
      frequency: analysis?.frequency ?? 1,
    };
    const priorityResult = scorePriority(
      priorityFactors.safety,
      priorityFactors.severity,
      priorityFactors.urgency,
      priorityFactors.frequency,
    );

    // 6. Insert the issue.
    // reporter_id is always taken from the verified user.
    const issuePayload = {
          title,
          description,
          location,
          category,
          reporter_id: user.id,
          assigned_department: assignedDepartment,
          routing_exception: !categoryIsValid,
          status: assignedDepartment ? "assigned" : "reported",
          assigned_at: assignedDepartment ? new Date().toISOString() : null,
          priority: priorityResult.priority,
          priority_level: priorityResult.priority,
          verification_status: "pending",
          priority_score: priorityResult.score,
          ai_category: analysis?.category ?? null,
          ai_summary: analysis?.summary ?? null,
          ai_reason: criticalSafetyReport
            ? "Critical safety language detected in the report."
            : analysis?.reason ?? "Gemini analysis unavailable; conservative fallback score used.",
          ai_safety: priorityFactors.safety,
          ai_severity: priorityFactors.severity,
          ai_urgency: priorityFactors.urgency,
          ai_frequency: priorityFactors.frequency,
    };

    const { data: databaseAuthUid, error: authUidError } = await supabase.rpc(
      "campusfix_current_user_id"
    );
    if (authUidError) {
      console.warn("[issues:create] auth.uid diagnostic RPC unavailable", {
        code: authUidError.code,
        message: authUidError.message,
        details: authUidError.details,
      });
    } else {
      console.info("[issues:create] database identity check", {
        authenticatedUserId: user.id,
        authUid: databaseAuthUid,
        reporterId: issuePayload.reporter_id,
        authUidMatchesAuthenticatedUser: databaseAuthUid === user.id,
        reporterMatchesAuthUid: databaseAuthUid === issuePayload.reporter_id,
      });
      if (databaseAuthUid !== user.id) {
        return jsonError(
          "The authenticated identity seen by PostgreSQL does not match the verified Supabase user.",
          401,
          `auth.uid()=${String(databaseAuthUid)}; authenticated user=${user.id}`,
          undefined,
          "database_identity_check",
          { reporterId: issuePayload.reporter_id }
        );
      }
    }

    const insertCallStack = new Error("Complaint insert call stack").stack;
    console.info("[issues:create] prepared insert", {
      userId: user.id,
      reporterId: issuePayload.reporter_id,
      category,
      categoryWasValid: categoryIsValid,
      aiCategory: analysis?.category ?? null,
      department: assignedDepartment,
      priority: priorityResult.priority,
      priorityScore: priorityResult.score,
      aiAvailable: Boolean(analysis),
      criticalSafetyReport,
      status: issuePayload.status,
      verificationStatus: issuePayload.verification_status,
      columns: Object.keys(issuePayload),
      titleLength: issuePayload.title.length,
      descriptionLength: issuePayload.description.length,
      locationLength: issuePayload.location.length,
      reporterMatchesAuthenticatedUser: issuePayload.reporter_id === user.id,
      idGeneratedByDatabase: true,
      createdAtGeneratedByDatabase: true,
    });
    console.info("[issues:create] complete insert payload", issuePayload);

    let { data: issue, error: issueInsertError } = await supabase
      .from("issues").insert(issuePayload).select("*").single();
    // The feature remains deployable before the additive migration is applied.
    if (issueInsertError && /column .* does not exist|schema cache/i.test(issueInsertError.message)) {
      console.warn("[issues:create] optional-column schema mismatch; retrying legacy insert", {
        code: issueInsertError.code,
        message: issueInsertError.message,
      });
      const { priority_level: _level, priority_score: _score, ai_category: _category, ai_summary: _summary, assigned_at: _assignedAt, routing_exception: _exception,
        ai_reason: _reason, ai_safety: _safety, ai_severity: _severity,
        ai_urgency: _urgency, ai_frequency: _frequency, ...legacyPayload } = issuePayload;
      ({ data: issue, error: issueInsertError } = await supabase
        .from("issues").insert(legacyPayload).select("*").single());
    }

    if (issueInsertError) {
      const constraint = issueInsertError.message.match(/constraint ["']?([\w.]+)["']?/i)?.[1];
      const rlsDenied = issueInsertError.code === "42501";
      const functionFailure = issueInsertError.code === "P0001";
      console.error("[issues:create] database insert failed", {
        stage: "database_insert",
        userId: user.id,
        reporterId: issuePayload.reporter_id,
        role: profile?.role ?? "student",
        department: assignedDepartment,
        priority: priorityResult.priority,
        category,
        payloadColumns: Object.keys(issuePayload),
        code: issueInsertError.code,
        message: issueInsertError.message,
        details: issueInsertError.details,
        hint: issueInsertError.hint,
        constraint,
        rlsDenied,
        functionFailure,
        stack: insertCallStack,
      });

      const reason = rlsDenied
        ? `Row-level security rejected complaint creation: ${issueInsertError.message}`
        : issueInsertError.code === "23514"
          ? `Database constraint ${constraint || "check constraint"} rejected the complaint: ${issueInsertError.message}`
          : issueInsertError.code === "23503"
            ? `A required related record is missing: ${issueInsertError.message}`
            : functionFailure
              ? `Database trigger or function rejected the complaint: ${issueInsertError.message}`
              : issueInsertError.message;

      return jsonError(
        reason || "Database rejected complaint creation.",
        500,
        issueInsertError.details || undefined,
        issueInsertError.code || undefined,
        "database_insert",
        {
          constraint,
          rlsDenied,
          functionFailure,
          authenticatedUserId: user.id,
          authUid: authUidError ? "diagnostic_unavailable" : databaseAuthUid,
          reporterId: issuePayload.reporter_id,
          profileRole: profile?.role ?? "student_created_for_request",
          department: assignedDepartment,
          category,
          priority: priorityResult.priority,
          assignedDepartment: issuePayload.assigned_department,
          verificationStatus: issuePayload.verification_status,
        }
      );
    }

    // 7. Return the newly created issue.
    return NextResponse.json(
      {
        success: true,
        message: "Issue reported successfully!",
        complaint: issue,
        issue,
        analysis: {
          available: Boolean(analysis),
          category: analysis?.category ?? null,
          summary: analysis?.summary ?? null,
          priority: priorityResult.priority,
          priorityScore: priorityResult.score,
          reason: criticalSafetyReport ? "Critical safety language detected." : analysis?.reason ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[issues:create] unexpected failure", {
      stage,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return jsonError(
      error instanceof Error ? error.message : "Unexpected server error.",
      500,
      undefined,
      undefined,
      stage
    );
  }
}
