import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

let admin: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so it is only used inside API routes
 * *after* the caller's identity and household membership have been verified.
 * The key never reaches the browser (no NEXT_PUBLIC_ prefix, server-only module).
 */
export function getSupabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfig.url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }
  if (!admin) {
    admin = createClient(supabaseConfig.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
