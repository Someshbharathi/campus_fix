
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  code?: string
) {
  return NextResponse.json(
    {
      error: message,
      ...(details ? { details } : {}),
      ...(code ? { code } : {}),
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

    const { data, error } = await auth.client
      .from("issues")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Issue retrieval failed:", error);

      return jsonError(
        "Could not retrieve issues.",
        500,
        error.message,
        error.code
      );
    }

    return NextResponse.json({ issues: data }, { status: 200 });
  } catch (error) {
    console.error("GET issues failed:", error);

    return jsonError("Unexpected server error.", 500);
  }
}

// POST /api/issues
// Creates an issue for the authenticated user.
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user.
    const auth = await authenticate(request);

    if (auth.response || !auth.client || !auth.user) {
      return auth.response!;
    }

    const supabase = auth.client;
    const user = auth.user;

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

    // 3. Validate fields.
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

    const category =
      typeof body.category === "string"
        ? body.category
        : "other";

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

    if (
      !allowedCategories.includes(
        category as (typeof allowedCategories)[number]
      )
    ) {
      return jsonError("Invalid issue category.", 400);
    }

    // 4. Look up the user's profile.
    const { data: profile, error: profileLookupError } =
      await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

    if (profileLookupError) {
      console.error("Profile lookup failed:", profileLookupError);

      return jsonError(
        "Could not look up the user profile.",
        500,
        profileLookupError.message,
        profileLookupError.code
      );
    }

    // 5. Create a student profile if one does not exist.
    if (!profile) {
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
        console.error("Profile creation failed:", profileInsertError);

        return jsonError(
          "Could not create the user profile.",
          500,
          profileInsertError.message,
          profileInsertError.code
        );
      }
    }

    // 6. Insert the issue.
    // reporter_id is always taken from the verified user.
    const { data: issue, error: issueInsertError } =
      await supabase
        .from("issues")
        .insert({
          title,
          description,
          location,
          category,
          reporter_id: user.id,
          status: "reported",
          priority: "medium",
        })
        .select("*")
        .single();

    if (issueInsertError) {
      console.error("Issue insertion failed:", issueInsertError);

      return jsonError(
        "Could not save the issue.",
        500,
        issueInsertError.message,
        issueInsertError.code
      );
    }

    // 7. Return the newly created issue.
    return NextResponse.json(
      {
        message: "Issue reported successfully!",
        issue,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST issues unexpected error:", error);

    return jsonError("Unexpected server error.", 500);
  }
}
