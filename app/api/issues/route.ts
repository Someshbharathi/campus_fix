
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getDepartmentForCategory } from "@/lib/department-routing";
import { authorizeStudentSubmission } from "@/lib/auth/roles";
import { analyzeComplaint, isCriticalSafetyReport, scorePriority } from "@/lib/ai/complaint-analysis";
import { getRoutingCategoryForAI, inferAIComplaintCategory } from "@/lib/ai/categories";
import { COMPLAINT_EMBEDDING_MODEL, embedComplaint, getSimilarityThresholds } from "@/lib/ai/embeddings";
import { createServiceClient } from "@/lib/supabase/service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const complaintMediaBucket = "campusfix-complaint-media";
const mediaExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
};

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

    const issueRows = data || [];
    const mediaPaths = [...new Set(issueRows
      .map((issue) => issue.image_path)
      .filter((path): path is string => Boolean(path) && !/^https?:\/\//i.test(path)))];
    const signedMediaByPath = new Map<string, string>();
    if (mediaPaths.length) {
      const { data: signedMedia, error: signedMediaError } = await auth.client.storage
        .from(complaintMediaBucket)
        .createSignedUrls(mediaPaths, 60 * 60);
      if (signedMediaError) {
        console.warn("Issue media signing failed:", { code: signedMediaError.name, message: signedMediaError.message });
      } else {
        signedMedia?.forEach((entry, index) => {
          if (entry.signedUrl) signedMediaByPath.set(mediaPaths[index], entry.signedUrl);
        });
      }
    }

    const issueIds = issueRows.map((issue) => issue.id);
    const { data: history } = issueIds.length
      ? await auth.client.from("issue_updates")
        .select("id, issue_id, actor_id, old_status, new_status, comment, created_at")
        .in("issue_id", issueIds)
        .order("created_at", { ascending: true })
      : { data: [] };
    const { data: similarRows } = issueIds.length
      ? await auth.client.from("campusfix_issue_similarity")
        .select("issue_id, similar_issue_id, related_category, similarity, same_category")
        .in("issue_id", issueIds)
      : { data: [] };
    const historyByIssue = new Map<string, typeof history>();
    for (const event of history || []) {
      historyByIssue.set(event.issue_id, [...(historyByIssue.get(event.issue_id) || []), event]);
    }
    const similaritiesByIssue = new Map<string, Array<{ id: string; category: string; similarity: number; same_category: boolean }>>();
    for (const match of similarRows || []) {
      similaritiesByIssue.set(match.issue_id, [...(similaritiesByIssue.get(match.issue_id) || []), {
        id: match.similar_issue_id,
        category: match.related_category,
        similarity: match.similarity,
        same_category: match.same_category,
      }]);
    }
    return NextResponse.json({
      issues: issueRows.map((issue) => ({
        ...issue,
        ...(issue.image_path && signedMediaByPath.has(issue.image_path)
          ? { image_path: signedMediaByPath.get(issue.image_path) }
          : {}),
        status_history: historyByIssue.get(issue.id) || [],
        similar_complaints: similaritiesByIssue.get(issue.id) || [],
        // These values are scoped to the similarity rows this caller can see.
        ai_recurrence_count: (similaritiesByIssue.get(issue.id) || []).length,
        ai_similarity_score: (similaritiesByIssue.get(issue.id) || []).reduce<number | null>(
          (maximum, match) => maximum === null ? match.similarity : Math.max(maximum, match.similarity),
          null
        ),
      })),
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
    let attachmentFile: File | null = null;
    let attachmentMediaType: string | null = null;
    let directAttachmentPath: string | null = null;
    let hasDirectAttachmentPath = false;

    try {
      if (request.headers.get("content-type")?.includes("multipart/form-data")) {
        const formData = await request.formData();
        body = {
          title: formData.get("title"),
          description: formData.get("description"),
          location: formData.get("location"),
        };
        const fileValue = formData.get("attachment");
        if (fileValue instanceof File) attachmentFile = fileValue;
        else if (fileValue !== null) return jsonError("Attachment must be a file.", 400);
      } else {
        const parsed: unknown = await request.json();
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return jsonError("Request body must be a JSON object.", 400);
        }
        body = parsed as Record<string, unknown>;
        if (body.attachment_path !== undefined) {
          hasDirectAttachmentPath = true;
          if (typeof body.attachment_path !== "string") {
            return jsonError("Attachment path must be text.", 400, undefined, "INVALID_ATTACHMENT_PATH", "attachment_validation");
          }
          directAttachmentPath = body.attachment_path;
        }
      }
    } catch {
      return jsonError("Request body must contain valid form data or JSON.", 400);
    }

    if (attachmentFile) {
      attachmentMediaType = attachmentFile.type.split(";")[0].toLowerCase();
      const isImage = attachmentMediaType.startsWith("image/");
      const maxBytes = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
      if (!mediaExtensions[attachmentMediaType]) {
        return jsonError("Use a supported photo or video format.", 400);
      }
      if (attachmentFile.size <= 0 || attachmentFile.size > maxBytes) {
        return jsonError(`Attachment is empty or exceeds the ${isImage ? "10 MB" : "50 MB"} limit.`, 400);
      }
    }

    if (hasDirectAttachmentPath) {
      const ownedPathPattern = new RegExp(
        `^${user.id}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:${Object.values(mediaExtensions).join("|")})$`,
        "i"
      );
      if (!directAttachmentPath || !ownedPathPattern.test(directAttachmentPath)) {
        return jsonError(
          "The uploaded attachment path is invalid or does not belong to this account.",
          400,
          undefined,
          "INVALID_ATTACHMENT_PATH",
          "attachment_validation"
        );
      }
    }

    console.info("[issues:create] request received", {
      userId: user.id,
      fields: Object.keys(body),
      titleLength: typeof body.title === "string" ? body.title.trim().length : null,
      descriptionLength: typeof body.description === "string" ? body.description.trim().length : null,
      locationLength: typeof body.location === "string" ? body.location.trim().length : null,
      evidenceProvided: Boolean(attachmentFile),
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

    const criticalSafetyReport = isCriticalSafetyReport(title, description);

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

    if (!profile) {
      return jsonError(
        "No CampusFix profile is registered for this account. Contact an administrator to restore your profile.",
        403,
        undefined,
        undefined,
        "profile_lookup",
        { userId: user.id, reason: "profile_missing" }
      );
    }

    const profileAuthorization = authorizeStudentSubmission(user.id, profile);
    if (!profileAuthorization.allowed) {
      const message = profileAuthorization.reason === "profile_missing"
        ? "No CampusFix profile is registered for this account. Contact an administrator to restore your profile."
        : profileAuthorization.reason === "profile_mismatch"
          ? "The CampusFix profile does not match the authenticated account."
          : profileAuthorization.reason === "invalid_role"
            ? "The CampusFix profile has an invalid role. Contact an administrator."
            : `This account is registered with the '${profileAuthorization.role}' role. Only student profiles can submit complaints.`;
      return jsonError(message, 403, undefined, undefined, "authorization", {
        userId: user.id,
        reason: profileAuthorization.reason,
        profileRole: profileAuthorization.role,
      });
    }
    console.info("[issues:create] authenticated profile", {
      userId: user.id,
      reporterId: profile.id,
      role: profile.role,
      profileFound: true,
      authUserMatchesProfile: profile.id === user.id,
    });

    stage = "ai_analysis";
    console.info("[issues:create] Gemini configuration", { apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY) });
    const analysis = await analyzeComplaint({ title, description, location });
    const aiCategory = analysis?.category ?? inferAIComplaintCategory(`${title}\n${description}\n${location}`);
    const category = getRoutingCategoryForAI(aiCategory);
    const assignedDepartment = getDepartmentForCategory(category);
    const embedding = await embedComplaint(`${title}\n${description}\n${location}`);
    if (!embedding) {
      console.warn("[issues:create] complaint embedding unavailable; check HUGGINGFACE_API_TOKEN and inference access");
    }
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

    // New clients upload directly to private Storage with TUS. Retain the
    // authenticated multipart path for compatibility with older clients.
    let uploadedAttachmentPath: string | null = directAttachmentPath;
    if (attachmentFile) {
      stage = "attachment_upload";
      uploadedAttachmentPath = `${user.id}/${randomUUID()}.${mediaExtensions[attachmentMediaType!]}`;
      const { error: uploadError } = await supabase.storage
        .from(complaintMediaBucket)
        .upload(uploadedAttachmentPath, await attachmentFile.arrayBuffer(), {
          contentType: attachmentMediaType!,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) {
        console.error("[issues:create] attachment upload failed", {
          userId: user.id,
          name: uploadError.name,
          status: (uploadError as { status?: number }).status ?? null,
          statusCode: (uploadError as { statusCode?: string }).statusCode ?? null,
          message: uploadError.message,
          bucket: complaintMediaBucket,
          fileSize: attachmentFile.size,
        });
        uploadedAttachmentPath = null;
        const statusCode = (uploadError as { statusCode?: string }).statusCode;
        const errorStatus = (uploadError as { status?: number }).status;
        const message = uploadError.message.toLowerCase();
        if (errorStatus === 413 || statusCode === "413" || /file size|payload too large|exceeds.*limit/.test(message)) {
          return jsonError("This file exceeds the active Supabase Storage size limit. Choose a smaller file or ask an administrator to check the project and bucket limits.", 413, undefined, statusCode, stage);
        }
        if ((errorStatus === 404 || statusCode === "404" || /bucket.*not found|bucket not found/.test(message)) && /bucket|not found/.test(message)) {
          return jsonError("The complaint media bucket is missing. Ask an administrator to apply the complaint media Storage migration.", 500, undefined, statusCode, stage);
        }
        if ([401, 403].includes(errorStatus ?? Number(statusCode)) || /row-level security|permission denied|unauthorized|policy/.test(message)) {
          return jsonError("Supabase Storage denied this upload. Sign in again; if it continues, ask an administrator to verify the private media upload policy.", 403, undefined, statusCode, stage);
        }
        return jsonError("Supabase Storage could not complete the upload. Check your connection and try again.", 502, undefined, statusCode, stage);
      }
    }
    stage = "database_insert";

    // 6. Insert the issue.
    // reporter_id is always taken from the verified user.
    const issuePayload = {
          title,
          description,
          location,
          category,
          reporter_id: user.id,
          assigned_department: assignedDepartment,
          routing_exception: false,
          status: assignedDepartment ? "assigned" : "reported",
          ...(uploadedAttachmentPath ? { image_path: uploadedAttachmentPath } : {}),
          priority: priorityResult.priority,
          priority_level: priorityResult.priority,
          verification_status: "pending",
          priority_score: priorityResult.score,
          ai_category: aiCategory,
          ai_summary: analysis?.summary ?? null,
          ai_reason: criticalSafetyReport
            ? "Critical safety language detected in the report."
            : analysis?.reason ?? "Gemini analysis unavailable; conservative fallback score used.",
          ai_safety: priorityFactors.safety,
          ai_severity: priorityFactors.severity,
          ai_urgency: priorityFactors.urgency,
          ai_frequency: priorityFactors.frequency,
          ai_affected_population: analysis?.affectedPopulation ?? null,
          ai_spam: analysis?.spam ?? null,
          ai_spam_reason: analysis?.spamReason || null,
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
        if (uploadedAttachmentPath) {
          const { error: cleanupError } = await supabase.storage.from(complaintMediaBucket).remove([uploadedAttachmentPath]);
          if (cleanupError) console.warn("[issues:create] identity-check attachment cleanup failed", { code: cleanupError.name, message: cleanupError.message });
        }
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
      aiCategory,
      department: assignedDepartment,
      priority: priorityResult.priority,
      priorityScore: priorityResult.score,
      aiAvailable: Boolean(analysis),
      embeddingAvailable: Boolean(embedding),
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
    let { data: issue, error: issueInsertError } = await supabase
      .from("issues").insert(issuePayload).select("*").single();
    // The feature remains deployable before the additive migration is applied.
    if (issueInsertError && /column .* does not exist|schema cache/i.test(issueInsertError.message)) {
      console.warn("[issues:create] optional-column schema mismatch; retrying legacy insert", {
        code: issueInsertError.code,
        message: issueInsertError.message,
      });
      const { priority_level: _level, priority_score: _score, ai_category: _category, ai_summary: _summary, routing_exception: _exception,
        ai_reason: _reason, ai_safety: _safety, ai_severity: _severity,
        ai_urgency: _urgency, ai_frequency: _frequency, ai_affected_population: _population,
        ai_spam: _spam, ai_spam_reason: _spamReason, ...legacyPayload } = issuePayload;
      ({ data: issue, error: issueInsertError } = await supabase
        .from("issues").insert(legacyPayload).select("*").single());
    }

    if (issueInsertError) {
      if (uploadedAttachmentPath) {
        const { error: cleanupError } = await supabase.storage.from(complaintMediaBucket).remove([uploadedAttachmentPath]);
        if (cleanupError) console.warn("[issues:create] orphan attachment cleanup failed", { code: cleanupError.name, message: cleanupError.message });
      }
      const constraint = issueInsertError.message.match(/constraint ["']?([\w.]+)["']?/i)?.[1];
      const rlsDenied = issueInsertError.code === "42501";
      const functionFailure = issueInsertError.code === "P0001";
      console.error("[issues:create] database insert failed", {
        stage: "database_insert",
        userId: user.id,
        reporterId: issuePayload.reporter_id,
        role: profile.role,
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
        ? "The database denied complaint creation. Confirm that your account has student submission access."
        : issueInsertError.code === "23514"
          ? `The complaint did not meet the database rule${constraint ? ` ${constraint}` : ""}. Please check its details or contact an administrator.`
          : issueInsertError.code === "23503"
            ? "A required linked account record is missing. Contact an administrator."
            : functionFailure
              ? "A database rule rejected the complaint. Contact an administrator with the complaint submission time."
              : "The complaint could not be saved. Please try again.";

      return jsonError(
        reason || "Database rejected complaint creation.",
        500,
        undefined,
        issueInsertError.code || undefined,
        "database_insert",
        {
          constraint,
          rlsDenied,
          functionFailure,
          authenticatedUserId: user.id,
          authUid: authUidError ? "diagnostic_unavailable" : databaseAuthUid,
          reporterId: issuePayload.reporter_id,
          profileRole: profile.role,
          department: assignedDepartment,
          category,
          priority: priorityResult.priority,
          assignedDepartment: issuePayload.assigned_department,
          verificationStatus: issuePayload.verification_status,
        }
      );
    }

    let similarities: Array<{ similar_issue_id: string; related_category: string; similarity: number; same_category: boolean }> = [];
    let embeddingPersisted = false;
    const serviceClient = embedding ? createServiceClient() : null;
    if (embedding && serviceClient) {
      const thresholds = getSimilarityThresholds();
      const { error: embeddingError } = await serviceClient.rpc("campusfix_store_issue_embedding", {
        p_issue_id: issue.id,
        p_model: COMPLAINT_EMBEDDING_MODEL,
        p_embedding: embedding,
        p_same_category_threshold: thresholds.sameCategory,
        p_cross_category_threshold: thresholds.crossCategory,
      });
      if (embeddingError) {
        console.error("[issues:create] embedding/similarity persistence failed", {
          issueId: issue.id,
          code: embeddingError.code,
          message: embeddingError.message,
        });
      } else {
        embeddingPersisted = true;
        // The service-role RPC intentionally returns no complaint IDs. Read
        // links back through the authenticated client so RLS limits them to
        // complaints this student is allowed to see.
        const { data: visibleRows, error: similarityReadError } = await supabase
          .from("campusfix_issue_similarity")
          .select("similar_issue_id, related_category, similarity, same_category")
          .eq("issue_id", issue.id);
        if (similarityReadError) {
          console.warn("Could not read authorized similarity links:", similarityReadError.message);
        } else {
          similarities = (visibleRows || []).map((row) => ({
            similar_issue_id: row.similar_issue_id,
            related_category: row.related_category,
            similarity: row.similarity,
            same_category: row.same_category,
          }));
        }
        const { data: refreshed } = await supabase.from("issues").select("*").eq("id", issue.id).maybeSingle();
        if (refreshed) {
          issue = {
            ...refreshed,
            ai_recurrence_count: similarities.length,
            ai_similarity_score: similarities.length
              ? Math.max(...similarities.map((match) => match.similarity))
              : null,
          };
        }
      }
    } else if (embedding) {
      console.warn("[issues:create] embedding generated but not stored: SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    if (uploadedAttachmentPath) {
      const { data: signedMedia, error: signedMediaError } = await supabase.storage
        .from(complaintMediaBucket)
        .createSignedUrl(uploadedAttachmentPath, 60 * 60);
      if (signedMediaError) {
        console.warn("[issues:create] attachment saved but preview URL could not be created", {
          code: signedMediaError.name,
          message: signedMediaError.message,
        });
      } else if (signedMedia?.signedUrl) {
        issue = { ...issue, image_path: signedMedia.signedUrl };
      }
    }

    // 7. Return the new independent complaint and non-identifying similarity metadata.
    return NextResponse.json(
      {
        success: true,
        message: "Issue reported successfully!",
        complaint: issue,
        issue,
        analysis: {
          available: Boolean(analysis),
          category: aiCategory,
          categoryConfidence: analysis?.categoryConfidence ?? 0,
          summary: analysis?.summary ?? null,
          priority: priorityResult.priority,
          priorityScore: priorityResult.score,
          reason: criticalSafetyReport ? "Critical safety language detected." : analysis?.reason ?? null,
          safety: priorityFactors.safety,
          severity: priorityFactors.severity,
          urgency: priorityFactors.urgency,
          frequency: priorityFactors.frequency,
          affectedPopulation: analysis?.affectedPopulation ?? null,
          spam: analysis?.spam ?? null,
          spamReason: analysis?.spamReason ?? null,
          embeddingAvailable: embeddingPersisted,
          embeddingGenerated: Boolean(embedding),
        },
        similarities,
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
