import type {
  Activity,
  AppNotification,
  Device,
  DeviceCommand,
  DeviceState,
  Household,
  HouseholdInvitation,
  HouseholdMember,
  Parcel,
  Profile,
  QuietHours,
  Visitor,
} from "@/types/dropin";
import type { StoredDeviceEvent } from "./events";

/**
 * Domain logic never writes to a database directly. It returns a list of
 * mutations which a store (browser demo store or Supabase) applies. This keeps
 * the behaviour identical in demo mode and production.
 */
export interface TableRows {
  profiles: Profile;
  households: Household;
  household_members: HouseholdMember;
  household_invitations: HouseholdInvitation;
  devices: Device;
  device_states: DeviceState;
  device_events: StoredDeviceEvent;
  device_commands: DeviceCommand;
  parcels: Parcel;
  visitors: Visitor;
  activities: Activity;
  notifications: AppNotification;
  quiet_hours: QuietHours;
}

export type TableName = keyof TableRows;

export type Mutation =
  | { [T in TableName]: { kind: "insert"; table: T; row: TableRows[T] } }[TableName]
  | { [T in TableName]: { kind: "update"; table: T; id: string; values: Partial<TableRows[T]> } }[TableName]
  | { [T in TableName]: { kind: "delete"; table: T; id: string } }[TableName];

export const insert = <T extends TableName>(table: T, row: TableRows[T]): Mutation =>
  ({ kind: "insert", table, row }) as Mutation;

export const update = <T extends TableName>(table: T, id: string, values: Partial<TableRows[T]>): Mutation =>
  ({ kind: "update", table, id, values }) as Mutation;

export const remove = <T extends TableName>(table: T, id: string): Mutation => ({ kind: "delete", table, id }) as Mutation;

export interface PushMessage {
  user_id: string;
  title: string;
  body: string;
  url: string | null;
  silent: boolean;
  tag: string;
}
