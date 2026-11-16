import { json, requireUser, route } from "@/lib/server/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Pending invitations addressed to the signed-in user's email. */
export const GET = route(async () => {
  const user = await requireUser();
  if (!user.email) return json({ invitations: [] });
  const { data } = await getSupabaseAdmin()
    .from("household_invitations")
    .select("id, role, created_at, household:households(name, building)")
    .eq("email", user.email.toLowerCase())
    .eq("status", "pending");
  return json({ invitations: data ?? [] });
});
