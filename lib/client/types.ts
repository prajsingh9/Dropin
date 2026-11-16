import type { DeviceCommand, DeviceCommandType, HouseholdSnapshot, NotificationPrefs, QuietHours, Visitor, Parcel } from "@/types/dropin";
import type { DeviceEventResponse } from "@/lib/domain/processor";
import type { SimulationActionId } from "@/lib/simulation/scenarios";
import type { ExpectedParcelInput, HouseholdInput, OnboardingInput, ProfileInput, QuietHoursInput, VisitorDecision } from "@/lib/backend/schemas";

export interface ClientSession {
  userId: string;
  email: string;
}

/**
 * What the UI can do. Implemented by the browser demo backend and by the
 * Supabase client (which calls the validated API routes).
 */
export interface DropinClient {
  mode: "demo" | "supabase";
  getSession(): Promise<ClientSession | null>;
  /** `null` means the user is signed in but has no household yet. */
  loadSnapshot(): Promise<HouseholdSnapshot | null>;
  subscribe(householdId: string, userId: string, onChange: () => void): () => void;
  signOut(): Promise<void>;

  completeOnboarding(input: OnboardingInput): Promise<void>;

  issueCommand(deviceId: string, type: DeviceCommandType, payload?: Record<string, unknown>): Promise<DeviceCommand>;
  respondToVisitor(visitorId: string, decision: VisitorDecision): Promise<{ visitor: Visitor; command: DeviceCommand | null }>;

  addExpectedParcel(input: ExpectedParcelInput): Promise<Parcel>;
  deleteExpectedParcel(parcelId: string): Promise<void>;
  markParcelCollected(parcelId: string): Promise<void>;

  updateQuietHours(input: QuietHoursInput): Promise<{ quietHours: QuietHours; synced: boolean }>;

  markNotificationsRead(ids: string[] | "all"): Promise<void>;
  updateNotificationPrefs(prefs: NotificationPrefs): Promise<void>;

  updateProfile(input: ProfileInput): Promise<void>;
  updateHousehold(input: HouseholdInput): Promise<void>;
  inviteMember(input: { email: string; role: "admin" | "resident" }): Promise<void>;
  revokeInvitation(id: string): Promise<void>;
  updateMember(id: string, input: { role?: "admin" | "resident"; permissions?: Record<string, boolean> }): Promise<void>;
  removeMember(id: string): Promise<void>;

  renameDevice(id: string, name: string): Promise<void>;
  removeDevice(id: string): Promise<void>;

  simulate(action: SimulationActionId, deviceId: string, snapshot: HouseholdSnapshot): Promise<DeviceEventResponse>;
  savePushSubscription?(subscription: PushSubscriptionJSON | null): Promise<void>;
}
