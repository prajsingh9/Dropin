import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DropinService, type Actor } from "@/lib/backend/service";
import { ServiceError } from "@/lib/backend/store";
import { CompositeGateway } from "@/lib/hardware/gateway";
import type { Device, HouseholdMember, Profile } from "@/types/dropin";
import { SupabaseAdminStore } from "./supabase-store";
import { rateLimit } from "./rate-limit";
import { sendPush } from "./push";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

function errorResponse(err: unknown) {
  if (err instanceof ZodError) return json({ error: err.issues[0]?.message ?? "Invalid input" }, 422);
  const status = (err as { status?: number })?.status;
  if (typeof status === "number" && status >= 400 && status < 600 && err instanceof Error) {
    return json({ error: err.message }, status);
  }
  console.error("[api] unhandled error", err);
  return json({ error: "Something went wrong on our side. Please try again." }, 500);
}

export function requireSupabase() {
  if (!isSupabaseConfigured) throw new HttpError(503, "Supabase isn't configured. The app is running in local demo mode.");
}

export async function readBody(req: NextRequest, maxBytes = 32_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body too large");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

export function service() {
  const admin = getSupabaseAdmin();
  return new DropinService(new SupabaseAdminStore(admin), new CompositeGateway(), { onPush: (m) => sendPush(admin, m) });
}

export async function requireUser() {
  requireSupabase();
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "Please sign in again.");
  return user;
}

/** Resolves the signed-in user's membership. Every resident API call starts here. */
export async function requireActor(): Promise<Actor & { email: string }> {
  const user = await requireUser();
  const admin = getSupabaseAdmin();
  const [{ data: member }, { data: profile }] = await Promise.all([
    admin.from("household_members").select("*").eq("user_id", user.id).order("created_at").limit(1).maybeSingle(),
    admin.from("profiles").select("id, full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!member) throw new HttpError(403, "You're not a member of a household yet.");
  return { member: member as HouseholdMember, profile: (profile as Pick<Profile, "id" | "full_name">) ?? { id: user.id, full_name: user.email ?? "Resident" }, email: user.email ?? "" };
}

export function limit(key: string, max: number, windowMs: number) {
  const r = rateLimit(key, max, windowMs);
  if (!r.ok) throw new HttpError(429, `Too many attempts. Try again in ${r.retryAfter}s.`);
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler with uniform error handling. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError || err instanceof ServiceError) return json({ error: err.message }, err.status);
      return errorResponse(err);
    }
  };
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Device authentication for the firmware gateway.
 * Header: `Authorization: Bearer <DEVICE_IDENTIFIER>.<PAIRING_CODE>`
 * Only the SHA-256 of the pairing code is stored.
 */
export async function requireDevice(req: NextRequest): Promise<Device> {
  requireSupabase();
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer ([A-Z0-9-]+)\.(.+)$/i.exec(header);
  if (!m) throw new HttpError(401, "Missing device credentials");
  const [, identifier, secret] = m;
  limit(`device:${identifier}`, 120, 60_000);
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("devices").select("*, device_secret_hash").eq("device_identifier", identifier!.toUpperCase()).maybeSingle();
  const expected = Buffer.from((data?.device_secret_hash as string | undefined) ?? "0".repeat(64), "hex");
  const actual = Buffer.from(hashSecret(secret!), "hex");
  if (!data || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new HttpError(401, "Invalid device credentials");
  const { device_secret_hash: _omit, ...device } = data as Device & { device_secret_hash: string };
  void _omit;
  return device as Device;
}
