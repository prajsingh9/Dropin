import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushMessage } from "@/lib/domain/mutations";

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@example.com", pub, priv);
  return (configured = true);
}

/**
 * Sends web push to every subscription of the target users. Payloads contain
 * only the title/body — never camera images — and expired subscriptions are
 * pruned. Native mobile push (APNs/FCM) can be added alongside by reading
 * the same `push_subscriptions` table with a `platform` column.
 */
export async function sendPush(db: SupabaseClient, messages: PushMessage[]) {
  if (!messages.length || !ensureConfigured()) return;
  const userIds = [...new Set(messages.map((m) => m.user_id))];
  const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
  if (!subs?.length) return;
  await Promise.allSettled(
    messages.flatMap((m) =>
      subs
        .filter((s) => s.user_id === m.user_id)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: m.title, body: m.body, url: m.url, silent: m.silent, tag: m.tag }),
              { TTL: 300, urgency: m.silent ? "low" : "high" },
            );
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
          }
        }),
    ),
  );
}
