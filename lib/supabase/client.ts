"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

let client: SupabaseClient | null = null;

/** Browser client — uses the anon key and the user's session. All reads go through RLS. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) client = createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
  return client;
}
