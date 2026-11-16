import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED = ["/home", "/parcels", "/visitors", "/activity", "/notifications", "/device", "/settings", "/onboarding"];

/**
 * Session refresh + route protection when Supabase is configured.
 * In demo mode there is no server-side session; the client gates routes.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/device-gateway|favicon.ico|sw.js|manifest.webmanifest|icons/|images/|offline).*)"],
};
