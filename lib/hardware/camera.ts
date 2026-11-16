/**
 * Camera & two-way audio abstraction for the outdoor doorbell.
 *
 * Dropin firmware has not published a streaming protocol yet. The UI talks to
 * this interface only, so a WebRTC (WHEP), HLS or vendor SDK implementation
 * can be dropped in without touching screens.
 */
export type StreamState = "idle" | "connecting" | "live" | "unavailable" | "error";

export interface CameraSession {
  /** "simulated" sessions render a generated scene and never transmit audio. */
  kind: "simulated" | "webrtc";
  state: StreamState;
  /** For real streams: the remote MediaStream to attach to a <video>. */
  stream: MediaStream | null;
  reason?: string;
  setMicrophone(enabled: boolean): Promise<void>;
  setSpeaker(enabled: boolean): void;
  close(): void;
}

export interface CameraProvider {
  connect(deviceId: string, opts: { onState: (s: StreamState, reason?: string) => void }): Promise<CameraSession>;
}

export class SimulatedCameraProvider implements CameraProvider {
  async connect(_deviceId: string, { onState }: { onState: (s: StreamState, reason?: string) => void }): Promise<CameraSession> {
    onState("connecting");
    await new Promise((r) => setTimeout(r, 1100));
    onState("live");
    const session: CameraSession = {
      kind: "simulated",
      state: "live",
      stream: null,
      async setMicrophone() {
        /* no audio leaves the browser in simulation */
      },
      setSpeaker() {},
      close() {
        onState("idle");
      },
    };
    return session;
  }
}

/**
 * Placeholder for the production stream. Requires:
 *  - a signalling endpoint exposed by Dropin firmware or a media relay (WHEP URL),
 *  - TURN credentials,
 *  - a short-lived stream token minted by our API after checking `can_view_camera`.
 */
export class UnconfiguredCameraProvider implements CameraProvider {
  async connect(_deviceId: string, { onState }: { onState: (s: StreamState, reason?: string) => void }): Promise<CameraSession> {
    const reason = "Live video needs the Dropin streaming service, which isn't configured for this deployment yet.";
    onState("unavailable", reason);
    return {
      kind: "webrtc",
      state: "unavailable",
      stream: null,
      reason,
      async setMicrophone() {},
      setSpeaker() {},
      close() {},
    };
  }
}

export function cameraProviderFor(device: { is_simulated: boolean }): CameraProvider {
  return device.is_simulated ? new SimulatedCameraProvider() : new UnconfiguredCameraProvider();
}
