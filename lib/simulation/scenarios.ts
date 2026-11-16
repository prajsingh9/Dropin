import type { DeviceEvent } from "@/lib/domain/events";
import type { DeviceEventType, Parcel, Visitor } from "@/types/dropin";
import { uid } from "@/lib/utils";

/**
 * Developer simulation. Builds normalized device events exactly like real
 * firmware would send, so they flow through the same processing pipeline.
 */
export const SIMULATION_ACTIONS = [
  { id: "parcel_deposited", label: "Parcel received", group: "Parcels" },
  { id: "parcel_deposited_unknown", label: "Parcel · unknown courier", group: "Parcels" },
  { id: "parcel_collected", label: "Parcel collected", group: "Parcels" },
  { id: "visitor_detected", label: "Visitor at door", group: "Visitors" },
  { id: "doorbell_pressed", label: "Doorbell pressed", group: "Visitors" },
  { id: "access_requested", label: "Access request", group: "Visitors" },
  { id: "access_granted", label: "Access granted (monitor)", group: "Visitors" },
  { id: "access_denied", label: "Access denied (monitor)", group: "Visitors" },
  { id: "compartment_opened", label: "Compartment opened", group: "Compartment" },
  { id: "compartment_closed", label: "Compartment closed", group: "Compartment" },
  { id: "compartment_left_open", label: "Left open alert", group: "Compartment" },
  { id: "device_offline", label: "Device offline", group: "Device" },
  { id: "device_online", label: "Device online", group: "Device" },
] as const;

export type SimulationActionId = (typeof SIMULATION_ACTIONS)[number]["id"];

const COURIERS = ["DHL", "FedEx", "Blue Dart", "Delhivery", "Amazon"];
const VISITORS = [null, null, "Courier", "Ananya", "Building staff", null];
const REQUESTS = ["building_entry", "parcel_delivery", "leave_parcel"] as const;

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]!;
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

export interface SimulationContext {
  household: { id: string };
  parcels: Pick<Parcel, "status" | "courier_name" | "tracking_number">[];
  visitors: Pick<Visitor, "id" | "status">[];
}

export function buildSimulatedEvent(action: SimulationActionId, snapshot: SimulationContext, deviceId: string): DeviceEvent {
  const base = { event_id: `sim_${uid()}`, device_id: deviceId, household_id: snapshot.household.id, timestamp: new Date().toISOString() };
  const seed = Math.floor(Math.random() * 1e6);
  const evt = (event_type: DeviceEventType, metadata: Record<string, unknown> = {}): DeviceEvent => ({ ...base, event_type, metadata });

  switch (action) {
    case "parcel_deposited": {
      // Prefer delivering something the household is expecting.
      const expected = snapshot.parcels.find((p) => p.status === "expected");
      const courier = expected?.courier_name ?? pick(COURIERS);
      return evt("parcel_deposited", {
        courier_name: courier,
        tracking_number: expected?.tracking_number ?? `${digits(4)}${digits(4)}${digits(4)}`,
        weight_kg: Math.round((0.3 + Math.random() * 4) * 10) / 10,
        image_url: `sim://parcel/${seed}`,
      });
    }
    case "parcel_deposited_unknown":
      return evt("parcel_deposited", { weight_kg: Math.round((0.2 + Math.random() * 2) * 10) / 10, image_url: `sim://parcel/${seed}` });
    case "parcel_collected":
      return evt("parcel_collected");
    case "visitor_detected":
      return evt("visitor_detected", { visitor_name: pick(VISITORS), image_url: `sim://visitor/${seed}` });
    case "doorbell_pressed":
      return evt("doorbell_pressed", { visitor_name: pick(VISITORS), image_url: `sim://visitor/${seed}` });
    case "access_requested": {
      const request_type = pick(REQUESTS);
      return evt("access_requested", {
        request_type,
        visitor_name: request_type === "building_entry" ? pick(["Ananya", "Rohan", "Plumber", null]) : pick(["Courier", "Delivery partner", null]),
        image_url: `sim://visitor/${seed}`,
      });
    }
    case "access_granted":
    case "access_denied": {
      const pending = snapshot.visitors.find((v) => v.status === "pending" || v.status === "ringing" || v.status === "answered");
      return evt(action, { visitor_id: pending?.id ?? null, via: "indoor monitor" });
    }
    case "compartment_left_open":
      return evt("compartment_left_open", { open_seconds: 120 });
    default:
      return evt(action);
  }
}
