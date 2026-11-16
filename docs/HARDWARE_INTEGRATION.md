# Dropin hardware integration

This document defines the contract between Dropin firmware (the parcel collector, outdoor doorbell and indoor monitor) and the cloud. Nothing here assumes a vendor SDK. The app works against these interfaces, and the simulator speaks exactly the same protocol.

## 1. Pairing

Each device ships with:

- **Device ID**: `DRP-XXXX-XXXX` (`SIM-XXXX-XXXX` is reserved for simulated devices)
- **Pairing code**: a factory secret of at least 6 characters

Both are printed on the back panel and encoded in a QR code:

```
dropin://pair?id=DRP-7Q4K-2M8D&code=<PAIRING_CODE>
```

During onboarding the resident scans this QR code or types it in. The backend stores the device with `connection_status = 'pending'` and keeps only `sha256(pairing_code)`. The device is shown as **online only after it authenticates**. Pairing never pretends a device has connected.

Wi-Fi is set up on the device itself, through its setup hotspot (`Dropin-XXXX`), and the app shows those steps. Implementing that hotspot portal is a firmware task.

## 2. Authentication

Every gateway request carries:

```
Authorization: Bearer <DEVICE_ID>.<PAIRING_CODE>
```

The server hashes the code and compares it in constant time. Requests are rate-limited per device.

## 3. Events (device → cloud)

`POST /api/device-gateway/events`

```json
{
  "event_id": "fw_01HZX…",              // unique; retries with the same id are ignored
  "device_id": "<uuid from pairing>",
  "household_id": "<uuid from pairing>",
  "event_type": "doorbell_pressed",
  "timestamp": "2026-11-16T22:41:05+05:30",
  "metadata": { }
}
```

| event_type | metadata (all optional) | Effect |
| --- | --- | --- |
| `parcel_deposited` | `courier_name`, `tracking_number`, `weight_kg`, `image_url`, `sender` | Matches an expected parcel by tracking number, or by a unique courier match; otherwise creates a parcel with "courier unknown". Compartment becomes occupied; residents are notified. |
| `parcel_collected` | — | Received parcels → collected; compartment empty. |
| `compartment_opened` / `compartment_closed` | — | Door state; closing auto-locks. |
| `compartment_left_open` | `open_seconds` | Security alert (always audible). |
| `doorbell_pressed` | `visitor_name`, `image_url` | Creates a ringing visit. **The response says whether to chime.** |
| `visitor_detected` | `visitor_name`, `image_url` | Motion visit; a ring within 3 minutes joins the same visit. |
| `access_requested` | `request_type` (`building_entry`, `parcel_delivery`, `leave_parcel`), `visitor_name`, `image_url` | Pending request residents can approve or deny. |
| `access_granted` / `access_denied` | `visitor_id`, `via` | Decision made on the indoor monitor; audited. |
| `device_online` / `device_offline` | — | Connectivity. Coming online flushes queued settings. |
| `camera_stream_available` | `stream_id` | Camera state → streaming. |
| `quiet_hours_updated` | `command_id` | **Acknowledgement only.** Devices cannot change the schedule. |

Response:

```json
{ "event_id": "…", "chime": false, "quiet_hours_active": true, "visitor_id": "…" }
```

Firmware **must** respect `chime`. While offline, it should fall back to the last schedule it received through `set_quiet_hours`.

`image_url` should be an object path in the private `dropin-media` bucket (`<household_id>/visitors/<file>.jpg`), uploaded with a short-lived signed upload URL. Images are never public.

## 4. Commands (cloud → device)

The default transport is pull: `GET /api/device-gateway/commands`. Call it on every heartbeat or long-poll; each call also counts as a heartbeat. It returns pending commands and marks them `sent`.

Physical-world commands (`unlock_compartment`, `lock_compartment`, `grant_access`, `deny_access`, `restart_device`) older than 2 minutes are **expired, never replayed late**.

Confirm each command:

`POST /api/device-gateway/commands/{id}/ack` with `{ "success": true }` or `{ "success": false, "error": "door obstructed" }`

The app only shows a command as done after this acknowledgement.

| command_type | payload |
| --- | --- |
| `unlock_compartment` | `{ reason? }` |
| `lock_compartment` | `{}` |
| `enable_doorbell` / `disable_doorbell` | `{}` |
| `set_doorbell_volume` | `{ volume: 0–100 }` |
| `set_quiet_hours` | `{ enabled, start_time "HH:MM", end_time, days_of_week [0–6], timezone }` |
| `restart_device` | `{}` |
| `grant_access` / `deny_access` | `{ visitor_id, request_type }` |

To push commands instead of polling (MQTT, AWS IoT, …), implement `DeviceGateway` in `lib/hardware/gateway.ts` and return `{ status: "sent" }` once the broker accepts the message.

## 5. Live video and two-way audio

The UI only talks to `CameraProvider` in `lib/hardware/camera.ts`. To enable real streams:

1. Firmware or a media relay exposes WebRTC (WHEP recommended) with TURN.
2. Add an API route that checks `can_view_camera` and mints a short-lived stream token.
3. Implement `CameraProvider.connect()` to negotiate the stream and return a `MediaStream`, and `setMicrophone()` to attach the resident's microphone track.

Until then, real devices show "Live video isn't available". Simulated devices show a generated scene clearly labelled as simulated, and no audio is transmitted.

## 6. Simulator

`lib/simulation/scenarios.ts` builds the same envelope described above. In Supabase mode it posts to `/api/simulate`, which runs the same `ingestEvent()` pipeline. The simulator only targets devices flagged `is_simulated`.
