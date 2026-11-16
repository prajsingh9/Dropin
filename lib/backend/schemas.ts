import { z } from "zod";
import { DEVICE_COMMAND_TYPES } from "@/types/dropin";

/** Input validation shared by API routes (server) and the demo backend (browser). */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

export const quietHoursInput = z
  .object({
    enabled: z.boolean(),
    start_time: hhmm,
    end_time: hhmm,
    days_of_week: z.array(z.number().int().min(0).max(6)).max(7),
    timezone: z.string().min(1).max(64).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
  })
  .refine((v) => v.start_time !== v.end_time, { message: "Start and end time can't be the same", path: ["end_time"] })
  .refine((v) => !v.enabled || v.days_of_week.length > 0, { message: "Pick at least one day", path: ["days_of_week"] });
export type QuietHoursInput = z.infer<typeof quietHoursInput>;

export const commandInput = z.object({
  device_id: z.string().uuid(),
  command_type: z.enum(DEVICE_COMMAND_TYPES),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type CommandInput = z.infer<typeof commandInput>;

export const visitorResponseInput = z.object({
  decision: z.enum(["answer", "decline", "end", "approve", "deny"]),
});
export type VisitorDecision = z.infer<typeof visitorResponseInput>["decision"];

export const expectedParcelInput = z.object({
  courier_name: z.string().trim().min(1, "Courier is required").max(60),
  tracking_number: z.string().trim().max(80).optional().transform((v) => v || null),
  sender: z.string().trim().max(80).optional().transform((v) => v || null),
  expected_at: z.iso.datetime({ offset: true }).nullable().optional(),
  weight_kg: z.number().positive().max(100).nullable().optional(),
});
export type ExpectedParcelInput = z.input<typeof expectedParcelInput>;

export const profileInput = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .max(24)
    .regex(/^[+()\d\s-]*$/, "Use digits, spaces and + only")
    .optional()
    .transform((v) => v || null),
  /** https URL from storage, or a small resized data URL. */
  avatar_url: z
    .string()
    .max(120_000, "Image is too large")
    .refine((v) => v.startsWith("https://") || v.startsWith("data:image/"), "Unsupported image")
    .nullable()
    .optional(),
});
export type ProfileInput = z.input<typeof profileInput>;

export const householdInput = z.object({
  name: z.string().trim().min(2, "Give your home a name").max(60),
  flat_number: z.string().trim().max(20).optional().transform((v) => v || null),
  building: z.string().trim().max(80).optional().transform((v) => v || null),
  address: z.string().trim().max(200).optional().transform((v) => v || null),
  timezone: z.string().min(1).max(64),
});
export type HouseholdInput = z.input<typeof householdInput>;

export const inviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["admin", "resident"]),
});

export const memberUpdateInput = z.object({
  role: z.enum(["admin", "resident"]).optional(),
  permissions: z
    .object({
      can_unlock: z.boolean(),
      can_manage_access: z.boolean(),
      can_view_camera: z.boolean(),
      can_manage_device: z.boolean(),
    })
    .optional(),
});

export const notificationPrefsInput = z.object({
  parcels: z.boolean(),
  visitors: z.boolean(),
  device: z.boolean(),
  security: z.boolean(),
  quiet_mode: z.enum(["silent", "hold"]),
  browser_push: z.boolean(),
});

export const deviceUpdateInput = z.object({
  device_name: z.string().trim().min(2).max(40),
});

/**
 * Pairing. A Dropin QR code encodes `dropin://pair?id=<DEVICE_ID>&code=<PAIRING_CODE>`.
 * The pairing code is the device's factory secret; we only ever store its hash.
 */
export const pairingInput = z.object({
  device_identifier: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(DRP|SIM)-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Device IDs look like DRP-XXXX-XXXX"),
  pairing_code: z.string().trim().min(6, "The pairing code is printed under the QR code").max(64),
  simulated: z.boolean().default(false),
});

export const onboardingInput = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(24).optional(),
  household: householdInput,
  device: pairingInput.extend({ device_name: z.string().trim().min(2).max(40).default("Front door Dropin") }),
  wifi_ssid: z.string().trim().max(64).nullable().optional(),
});
export type OnboardingInput = z.input<typeof onboardingInput>;

export function parseDeviceQr(raw: string): { device_identifier: string; pairing_code: string } | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "dropin:") return null;
    const id = url.searchParams.get("id");
    const code = url.searchParams.get("code");
    if (!id || !code) return null;
    return { device_identifier: id.toUpperCase(), pairing_code: code };
  } catch {
    return null;
  }
}
