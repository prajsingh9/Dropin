import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, readBody, requireUser, route } from "@/lib/server/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const input = z.object({
  subscription: z
    .object({
      endpoint: z.string().url().max(1000),
      keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
    })
    .nullable(),
});

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { subscription } = input.parse(await readBody(req));
  const admin = getSupabaseAdmin();
  if (!subscription) {
    await admin.from("push_subscriptions").delete().eq("user_id", user.id);
    return json({ ok: true });
  }
  await admin.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, platform: "web", user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null },
    { onConflict: "endpoint" },
  );
  return json({ ok: true }, 201);
});
