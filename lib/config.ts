/**
 * Runtime configuration. Everything here is safe for the browser:
 * only NEXT_PUBLIC_* values are read.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfig = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };

/** True when Supabase credentials are present. Otherwise the app runs in local demo mode. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const appMode: "supabase" | "demo" = isSupabaseConfigured ? "supabase" : "demo";

/**
 * The hardware simulator is a developer tool. It is available:
 *  - in `next dev`,
 *  - in local demo mode (no Supabase — there is no real hardware or data to protect),
 *  - in a Supabase-backed production build only if NEXT_PUBLIC_ENABLE_SIMULATOR=true (staging).
 * It can only ever target devices flagged as simulated.
 */
export const isSimulatorEnabled =
  process.env.NODE_ENV !== "production" || !isSupabaseConfigured || process.env.NEXT_PUBLIC_ENABLE_SIMULATOR === "true";

export const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
