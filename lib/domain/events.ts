import { z } from "zod";
import { DEVICE_EVENT_TYPES, type DeviceEventType } from "@/types/dropin";

/**
 * The normalized event envelope every Dropin device (or the simulator) emits.
 * Firmware should POST exactly this shape to `/api/device-gateway/events`.
 */
export const deviceEventSchema = z.object({
  event_id: z.string().min(8).max(64),
  device_id: z.string().uuid(),
  household_id: z.string().uuid(),
  event_type: z.enum(DEVICE_EVENT_TYPES),
  timestamp: z.iso.datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type DeviceEvent = z.infer<typeof deviceEventSchema>;

export type EventProcessingStatus = "received" | "processed" | "duplicate" | "failed";

export interface StoredDeviceEvent extends DeviceEvent {
  processing_status: EventProcessingStatus;
  error: string | null;
  received_at: string;
}

/** Strongly typed metadata accessors — device metadata is untrusted input. */
export const parcelDepositMeta = z.object({
  courier_name: z.string().trim().max(60).nullish(),
  tracking_number: z.string().trim().max(80).nullish(),
  weight_kg: z.number().positive().max(100).nullish(),
  image_url: z.string().max(500).nullish(),
  sender: z.string().trim().max(80).nullish(),
});

export const visitorMeta = z.object({
  visitor_name: z.string().trim().max(80).nullish(),
  image_url: z.string().max(500).nullish(),
  visitor_id: z.string().uuid().nullish(),
  request_type: z.enum(["doorbell", "building_entry", "parcel_delivery", "leave_parcel"]).nullish(),
  via: z.string().max(40).nullish(),
});

export const leftOpenMeta = z.object({ open_seconds: z.number().int().positive().max(86400).nullish() });

export const quietSyncMeta = z.object({ command_id: z.string().uuid().nullish() });

export const EVENT_LABELS: Record<DeviceEventType, string> = {
  doorbell_pressed: "Doorbell pressed",
  visitor_detected: "Visitor detected",
  parcel_deposited: "Parcel received",
  parcel_collected: "Parcel collected",
  compartment_opened: "Compartment opened",
  compartment_closed: "Compartment closed",
  compartment_left_open: "Compartment left open",
  access_requested: "Access requested",
  access_granted: "Access granted",
  access_denied: "Access denied",
  device_online: "Device online",
  device_offline: "Device offline",
  camera_stream_available: "Camera stream available",
  quiet_hours_updated: "Quiet hours synced",
};
