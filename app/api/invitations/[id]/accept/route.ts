import type { NextRequest } from "next/server";
import { HttpError, json, requireUser, route } from "@/lib/server/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_NOTIFICATION_PREFS, ROLE_DEFAULT_PERMISSIONS } from "@/lib/domain/permissions";
import type { MemberRole } from "@/types/dropin";

export const POST = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireUser();
  const admin = getSupabaseAdmin();
  const { data: inv } = await admin.from("household_invitations").select("*").eq("id", id).maybeSingle();
  // Invitations are bound to the email they were sent to.
  if (!inv || inv.status !== "pending" || inv.email !== user.email?.toLowerCase()) throw new HttpError(404, "Invitation not found");
  const role = inv.role as MemberRole;
  await admin.from("profiles").upsert({ id: user.id, email: user.email, full_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Resident" }, { onConflict: "id", ignoreDuplicates: true });
  const { error } = await admin.from("household_members").insert({ household_id: inv.household_id, user_id: user.id, role, permissions: ROLE_DEFAULT_PERMISSIONS[role], notification_prefs: DEFAULT_NOTIFICATION_PREFS });
  if (error) throw new HttpError(409, "Couldn't join this household. You may already be a member.");
  await admin.from("household_invitations").update({ status: "accepted" }).eq("id", id);
  await admin.from("activities").insert({ household_id: inv.household_id, event_type: "member_invited", category: "security", title: "Resident joined", description: `${user.email} accepted their invitation.`, actor_id: user.id });
  return json({ household_id: inv.household_id });
});
