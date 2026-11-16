/**
 * Core Dropin domain types. These mirror the Supabase schema in
 * `supabase/migrations` one-to-one so that the demo store and the
 * Supabase store can share the same domain logic.
 */

export type ISODate = string;

export type MemberRole = "owner" | "admin" | "resident";

export interface MemberPermissions {
  can_unlock: boolean;
  can_manage_access: boolean;
  can_view_camera: boolean;
  can_manage_device: boolean;
}

export interface NotificationPrefs {
  parcels: boolean;
  visitors: boolean;
  device: boolean;
  security: boolean;
  /** During quiet hours: "silent" = deliver without sound, "hold" = only record in notification centre. */
  quiet_mode: "silent" | "hold";
  browser_push: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: ISODate;
}

export interface Household {
  id: string;
  name: string;
  flat_number: string | null;
  building: string | null;
  address: string | null;
  timezone: string;
  created_at: ISODate;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRole;
  permissions: MemberPermissions;
  notification_prefs: NotificationPrefs;
  created_at: ISODate;
  profile?: Pick<Profile, "full_name" | "email" | "avatar_url"> | null;
}

export interface HouseholdInvitation {
  id: string;
  household_id: string;
  email: string;
  role: MemberRole;
  status: "pending" | "accepted" | "revoked";
  invited_by: string;
  created_at: ISODate;
}

export type DeviceType = "parcel_collector" | "video_doorbell" | "indoor_monitor";
export type ConnectionStatus = "online" | "offline" | "pending" | "error";

export interface Device {
  id: string;
  household_id: string;
  device_name: string;
  device_type: DeviceType;
  device_identifier: string;
  connection_status: ConnectionStatus;
  firmware_version: string | null;
  wifi_ssid: string | null;
  wifi_signal: number | null; // 0–100
  doorbell_volume: number; // 0–100
  doorbell_enabled: boolean;
  is_simulated: boolean;
  last_seen_at: ISODate | null;
  created_at: ISODate;
}

export type CompartmentStatus = "empty" | "occupied" | "error";
export type DoorStatus = "open" | "closed";
export type LockStatus = "locked" | "unlocked";
export type CameraStatus = "ready" | "streaming" | "offline";

export interface DeviceState {
  id: string;
  device_id: string;
  compartment_status: CompartmentStatus;
  door_status: DoorStatus;
  lock_status: LockStatus;
  camera_status: CameraStatus;
  door_opened_at: ISODate | null;
  last_deposit_at: ISODate | null;
  updated_at: ISODate;
}

export type ParcelStatus = "expected" | "received" | "collected";

export interface Parcel {
  id: string;
  household_id: string;
  device_id: string | null;
  courier_name: string | null; // null = unidentified courier
  sender: string | null;
  tracking_number: string | null;
  weight_kg: number | null;
  image_url: string | null;
  status: ParcelStatus;
  source: "manual" | "device";
  expected_at: ISODate | null;
  deposited_at: ISODate | null;
  collected_at: ISODate | null;
  collected_by: string | null;
  created_at: ISODate;
}

export type VisitorRequestType = "doorbell" | "building_entry" | "parcel_delivery" | "leave_parcel";
export type VisitorStatus = "detected" | "ringing" | "answered" | "pending" | "approved" | "denied" | "declined" | "missed" | "ended";

export interface Visitor {
  id: string;
  household_id: string;
  device_id: string | null;
  visitor_name: string | null;
  image_url: string | null;
  request_type: VisitorRequestType;
  status: VisitorStatus;
  during_quiet_hours: boolean;
  chime_played: boolean;
  arrived_at: ISODate;
  responded_at: ISODate | null;
  responded_by: string | null;
}

export const DEVICE_EVENT_TYPES = [
  "doorbell_pressed",
  "visitor_detected",
  "parcel_deposited",
  "parcel_collected",
  "compartment_opened",
  "compartment_closed",
  "compartment_left_open",
  "access_requested",
  "access_granted",
  "access_denied",
  "device_online",
  "device_offline",
  "camera_stream_available",
  "quiet_hours_updated",
] as const;
export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];

export type ActivityCategory = "parcels" | "visitors" | "security" | "device";

export interface Activity {
  id: string;
  household_id: string;
  device_id: string | null;
  event_type: DeviceEventType | "parcel_expected" | "quiet_hours_changed" | "member_invited" | "member_removed" | "command";
  category: ActivityCategory;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  created_at: ISODate;
}

export type NotificationKind =
  | "parcel_received"
  | "visitor_at_door"
  | "doorbell_pressed"
  | "access_request"
  | "access_granted"
  | "access_denied"
  | "parcel_collected"
  | "compartment_left_open"
  | "device_disconnected"
  | "device_reconnected"
  | "security_alert";

export interface AppNotification {
  id: string;
  household_id: string;
  user_id: string;
  event_type: NotificationKind;
  category: ActivityCategory;
  title: string;
  description: string;
  image_url: string | null;
  action_url: string | null;
  silent: boolean;
  read_at: ISODate | null;
  created_at: ISODate;
}

export interface QuietHours {
  id: string;
  household_id: string;
  enabled: boolean;
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  days_of_week: number[]; // 0 = Sunday … 6 = Saturday — the day the window *starts*
  timezone: string;
  updated_at: ISODate;
  updated_by: string | null;
  synced_at: ISODate | null;
}

export const DEVICE_COMMAND_TYPES = [
  "unlock_compartment",
  "lock_compartment",
  "enable_doorbell",
  "disable_doorbell",
  "set_doorbell_volume",
  "set_quiet_hours",
  "restart_device",
  "grant_access",
  "deny_access",
] as const;
export type DeviceCommandType = (typeof DEVICE_COMMAND_TYPES)[number];

/**
 * pending  — stored, not yet delivered to the device
 * sent     — handed to the device transport
 * completed — device acknowledged success
 * failed   — device reported failure or command was rejected
 * expired  — never acknowledged within its TTL
 */
export type CommandStatus = "pending" | "sent" | "completed" | "failed" | "expired";

export interface DeviceCommand {
  id: string;
  device_id: string;
  household_id: string;
  command_type: DeviceCommandType;
  payload: Record<string, unknown>;
  status: CommandStatus;
  error: string | null;
  issued_by: string | null;
  created_at: ISODate;
  completed_at: ISODate | null;
}

/** Everything the client needs to render a household. */
export interface HouseholdSnapshot {
  user: Profile;
  household: Household;
  membership: HouseholdMember;
  members: HouseholdMember[];
  invitations: HouseholdInvitation[];
  devices: Device[];
  deviceStates: Record<string, DeviceState>;
  parcels: Parcel[];
  visitors: Visitor[];
  activities: Activity[];
  notifications: AppNotification[];
  quietHours: QuietHours | null;
  commands: DeviceCommand[];
}
