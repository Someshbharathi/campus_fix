
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEPARTMENT_OPTIONS, getCanonicalDepartment, getDepartmentDisplayName } from "@/lib/department-routing";

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
      .select("role, department, authority_scope")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return jsonError("Unable to verify user permissions.", 500);
    }

    if (
      !profile ||
      profile.role !== "department_authority"
    ) {
      return jsonError(
        "Only authorized department authorities can access these complaints.",
        403
      );
    }

    const authorityScope = profile.authority_scope === "all_departments"
      ? "all_departments"
      : "assigned_department";

    if (authorityScope === "assigned_department" && !profile.department) {
      return jsonError(
        "No department is assigned to your profile. Contact an administrator.",
        403
      );
    }

    // Return routed complaints assigned to this user's department only.
    // Pending complaints remain pending; visibility does not approve them.
    const canonicalDepartment = profile.department
      ? getCanonicalDepartment(profile.department) || profile.department
      : null;
    const departmentValues = authorityScope === "all_departments"
      ? [...new Set(DEPARTMENT_OPTIONS.flatMap(({ canonical, label }) => [canonical, label]))]
      : [...new Set([
          profile.department!,
          canonicalDepartment!,
          getDepartmentDisplayName(canonicalDepartment!),
        ])];
    let issuesQuery = supabase.from("issues").select("*");
    if (authorityScope !== "all_departments") {
      issuesQuery = issuesQuery.in("assigned_department", departmentValues);
    }
    // The endpoint returns the authority's full readable set for counters,
    // filters, and review context. RLS permits reads by scope while keeping
    // writes restricted to eligible work states.
    const { data: issues, error: issuesError } = await issuesQuery
      .order("created_at", { ascending: false });

    if (issuesError) {
      console.error("Authority issues query failed:", issuesError.message);
      return jsonError(
        "Unable to retrieve department complaints. Check database permissions.",
        500
      );
    }

    const issueIds = issues.map((issue) => issue.id);
    const { data: history } = issueIds.length
      ? await supabase.from("issue_updates")
        .select("id, issue_id, actor_id, old_status, new_status, comment, created_at")
        .in("issue_id", issueIds)
        .order("created_at", { ascending: true })
      : { data: [] };
    const { data: similarityRows } = issueIds.length
      ? await supabase.from("campusfix_issue_similarity")
        .select("issue_id, similar_issue_id, related_category, similarity, same_category")
        .in("issue_id", issueIds)
      : { data: [] };
    const historyByIssue = new Map<string, typeof history>();
    for (const event of history || []) {
      historyByIssue.set(event.issue_id, [...(historyByIssue.get(event.issue_id) || []), event]);
    }
    const similaritiesByIssue = new Map<string, Array<{ id: string; category: string; similarity: number; same_category: boolean }>>();
    for (const match of similarityRows || []) {
      similaritiesByIssue.set(match.issue_id, [...(similaritiesByIssue.get(match.issue_id) || []), {
        id: match.similar_issue_id,
        category: match.related_category,
        similarity: match.similarity,
        same_category: match.same_category,
      }]);
    }
    return NextResponse.json({
      department: profile.department,
      authorityScope,
      count: issues.length,
      issues: issues.map((issue) => ({
        ...issue,
        status_history: historyByIssue.get(issue.id) || [],
        similar_complaints: similaritiesByIssue.get(issue.id) || [],
        // Derive aggregates from this authority's RLS-visible links only.
        ai_recurrence_count: (similaritiesByIssue.get(issue.id) || []).length,
        ai_similarity_score: (similaritiesByIssue.get(issue.id) || []).reduce<number | null>(
          (maximum, match) => maximum === null ? match.similarity : Math.max(maximum, match.similarity),
          null
        ),
      })),
    });
  } catch (error) {
    console.error("Authority issues API error:", error);
    return jsonError("Unexpected server error.", 500);
  }
}
