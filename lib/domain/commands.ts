import { z } from "zod";
import type { Device, DeviceCommand, DeviceCommandType, DeviceState, QuietHours } from "@/types/dropin";
import { update, type Mutation } from "./mutations";
import { QUEUEABLE_COMMANDS } from "./processor";

export const COMMAND_PAYLOADS = {
  unlock_compartment: z.object({ reason: z.string().max(80).optional() }).strict(),
  lock_compartment: z.object({}).strict(),
  enable_doorbell: z.object({}).strict(),
  disable_doorbell: z.object({}).strict(),
  set_doorbell_volume: z.object({ volume: z.number().int().min(0).max(100) }).strict(),
  set_quiet_hours: z
    .object({
      enabled: z.boolean(),
      start_time: z.string().regex(/^\d{2}:\d{2}$/),
      end_time: z.string().regex(/^\d{2}:\d{2}$/),
      days_of_week: z.array(z.number().int().min(0).max(6)).max(7),
      timezone: z.string().min(1).max(64),
    })
    .strict(),
  restart_device: z.object({}).strict(),
  grant_access: z.object({ visitor_id: z.string().uuid(), request_type: z.string() }).strict(),
  deny_access: z.object({ visitor_id: z.string().uuid(), request_type: z.string() }).strict(),
} satisfies Record<DeviceCommandType, z.ZodType>;

export const COMMAND_LABELS: Record<DeviceCommandType, string> = {
  unlock_compartment: "Unlock compartment",
  lock_compartment: "Lock compartment",
  enable_doorbell: "Turn chime on",
  disable_doorbell: "Turn chime off",
  set_doorbell_volume: "Set doorbell volume",
  set_quiet_hours: "Sync quiet hours",
  restart_device: "Restart device",
  grant_access: "Grant access",
  deny_access: "Deny access",
};

export class CommandRejectedError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "CommandRejectedError";
  }
}

/**
 * Commands that act on the physical world right now (unlocking, letting someone
 * in, restarting) are rejected when the device is offline — queuing them would
 * be unsafe. Settings are queued and delivered on reconnect.
 */
export function checkCommandPreconditions(device: Device, state: DeviceState | undefined, type: DeviceCommandType): void {
  if (device.connection_status === "pending") {
    throw new CommandRejectedError(`${device.device_name} hasn't checked in yet. Finish setting up the device first.`);
  }
  if (device.connection_status !== "online" && !QUEUEABLE_COMMANDS.has(type)) {
    throw new CommandRejectedError(`${device.device_name} is offline. This action needs a live connection.`);
  }
  if (type === "unlock_compartment" && state?.lock_status === "unlocked") {
    throw new CommandRejectedError("The compartment is already unlocked.");
  }
  if (type === "lock_compartment" && state?.door_status === "open") {
    throw new CommandRejectedError("Close the compartment door before locking it.");
  }
}

/**
 * State changes that become true once a device *confirms* a command. Applied by
 * the simulated gateway immediately, or by the device-gateway ack endpoint for
 * real hardware. Nothing here runs before confirmation.
 */
export function commandCompletionMutations(
  command: DeviceCommand,
  ctx: { device: Device; state?: DeviceState; quietHours?: QuietHours | null },
  completedAt: string,
): Mutation[] {
  const out: Mutation[] = [update("device_commands", command.id, { status: "completed", completed_at: completedAt, error: null })];
  const p = command.payload as Record<string, unknown>;
  const stateUpdate = (values: Partial<DeviceState>) => ctx.state && out.push(update("device_states", ctx.state.id, { ...values, updated_at: completedAt }));
  switch (command.command_type) {
    case "unlock_compartment":
      stateUpdate({ lock_status: "unlocked" });
      break;
    case "lock_compartment":
      stateUpdate({ lock_status: "locked" });
      break;
    case "enable_doorbell":
      out.push(update("devices", ctx.device.id, { doorbell_enabled: true }));
      break;
    case "disable_doorbell":
      out.push(update("devices", ctx.device.id, { doorbell_enabled: false }));
      break;
    case "set_doorbell_volume":
      out.push(update("devices", ctx.device.id, { doorbell_volume: Number(p.volume) }));
      break;
    case "set_quiet_hours":
      if (ctx.quietHours) out.push(update("quiet_hours", ctx.quietHours.id, { synced_at: completedAt }));
      break;
    case "restart_device":
      out.push(update("devices", ctx.device.id, { last_seen_at: completedAt }));
      break;
    case "grant_access":
      if (p.request_type === "leave_parcel" || p.request_type === "parcel_delivery") stateUpdate({ lock_status: "unlocked" });
      break;
    case "deny_access":
      break;
  }
  return out;
}
