import type { Device, DeviceState } from "@/types/dropin";

export type CompartmentVisual = "empty" | "deposited" | "awaiting" | "open" | "error" | "offline" | "pending";

export interface DeviceVisual {
  key: CompartmentVisual;
  title: string;
  description: string;
  tone: "neutral" | "accent" | "success" | "danger" | "muted";
}

const RECENT_DEPOSIT_MS = 15 * 60_000;

/** Collapses device + sensor state into one of the compartment's graphical states. */
export function deviceVisual(device: Device | undefined, state: DeviceState | undefined, now = Date.now()): DeviceVisual {
  if (!device) return { key: "pending", title: "No device", description: "Pair a Dropin to get started.", tone: "muted" };
  if (device.connection_status === "pending") return { key: "pending", title: "Waiting for device", description: "Your Dropin hasn't checked in yet. Power it on and connect it to Wi-Fi.", tone: "muted" };
  if (device.connection_status === "error" || state?.compartment_status === "error") return { key: "error", title: "Device needs attention", description: "The compartment reported a fault. See troubleshooting.", tone: "danger" };
  if (device.connection_status === "offline") return { key: "offline", title: "Device offline", description: "Showing the last known state. Changes will sync when it reconnects.", tone: "muted" };
  if (state?.door_status === "open") return { key: "open", title: "Compartment open", description: "The parcel door is open.", tone: "accent" };
  if (state?.compartment_status === "occupied") {
    const recent = state.last_deposit_at && now - new Date(state.last_deposit_at).getTime() < RECENT_DEPOSIT_MS;
    return recent
      ? { key: "deposited", title: "Parcel just arrived", description: "A parcel was deposited and the door locked.", tone: "accent" }
      : { key: "awaiting", title: "Parcel waiting", description: "Locked safely inside, ready for collection.", tone: "accent" };
  }
  return { key: "empty", title: "Compartment empty", description: "Closed, locked and ready for deliveries.", tone: "success" };
}
