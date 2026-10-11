import { createClient } from "@supabase/supabase-js";

/** Privileged Supabase client for trusted server operations only. */
export function createServiceClient() {
  if (typeof window !== "undefined") throw new Error("The Supabase service client is server-only.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
