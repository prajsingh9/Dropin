import { appMode, isSimulatorEnabled } from "@/lib/config";
import { json } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ ok: true, mode: appMode, simulator: isSimulatorEnabled, time: new Date().toISOString() });
}
