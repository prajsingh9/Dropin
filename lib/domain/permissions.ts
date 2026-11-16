import type { HouseholdMember, MemberPermissions, MemberRole, NotificationPrefs } from "@/types/dropin";

export const ROLE_DEFAULT_PERMISSIONS: Record<MemberRole, MemberPermissions> = {
  owner: { can_unlock: true, can_manage_access: true, can_view_camera: true, can_manage_device: true },
  admin: { can_unlock: true, can_manage_access: true, can_view_camera: true, can_manage_device: true },
  resident: { can_unlock: true, can_manage_access: true, can_view_camera: true, can_manage_device: false },
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  parcels: true,
  visitors: true,
  device: true,
  security: true,
  quiet_mode: "silent",
  browser_push: false,
};

export const PERMISSION_LABELS: Record<keyof MemberPermissions, string> = {
  can_unlock: "Unlock parcel compartment",
  can_manage_access: "Approve or deny visitors",
  can_view_camera: "View doorbell camera",
  can_manage_device: "Change device settings",
};

export function isAdmin(member: Pick<HouseholdMember, "role"> | null | undefined): boolean {
  return member?.role === "owner" || member?.role === "admin";
}

export function can(member: Pick<HouseholdMember, "role" | "permissions"> | null | undefined, permission: keyof MemberPermissions): boolean {
  if (!member) return false;
  if (member.role === "owner") return true;
  return Boolean(member.permissions?.[permission]);
}

export class PermissionError extends Error {
  status = 403;
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "PermissionError";
  }
}

export function assertCan(member: Pick<HouseholdMember, "role" | "permissions"> | null | undefined, permission: keyof MemberPermissions) {
  if (!can(member, permission)) throw new PermissionError();
}

export function assertAdmin(member: Pick<HouseholdMember, "role"> | null | undefined) {
  if (!isAdmin(member)) throw new PermissionError("Only household owners and admins can do that.");
}
