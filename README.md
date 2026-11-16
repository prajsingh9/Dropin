# Dropin

The control centre for the **Dropin** smart parcel collector, outdoor video doorbell and indoor monitor. Residents can see parcels as they arrive, answer and let in visitors, set quiet hours, and manage their household and hardware.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion, Lucide and Supabase (auth, Postgres + RLS, Realtime, Storage). It deploys to Vercel.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

If no Supabase credentials are set, the app runs in **local demo mode**:

- Sign-in is local. On `/login`, pick **Explore a sample home** (a lived-in household) or **Set up a new Dropin** (the full onboarding flow).
- Data is kept in `localStorage` and syncs between tabs.
- Hardware is simulated. Use the yellow **Simulate** button to send parcels, visitors, access requests, door events and connectivity changes.
- Demo mode is labelled in the UI, and simulated devices always carry a "Simulated" badge.

Demo mode runs the **same domain service and event processor** as production (`lib/backend/service.ts`, `lib/domain/processor.ts`). Only the storage layer is different.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (type-checks too) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript + React Compiler rules) |
| `npm run typecheck` | `tsc --noEmit` |

## Connecting Supabase

1. Create a Supabase project.
2. Run the migration in `supabase/migrations/20261116000000_dropin_schema.sql`, either with the SQL editor or with `supabase db push`. It creates:
   - tables, enums, indexes and constraints
   - Row Level Security on every table, scoped to household membership
   - column grants (clients can never read `devices.device_secret_hash`; they can only update `notifications.read_at`)
   - the Realtime publication
   - a private `dropin-media` storage bucket with household-scoped read policies
3. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # server only, never NEXT_PUBLIC_
   ```
4. In Supabase → Authentication → URL configuration, add `https://<your-domain>/auth/callback` as a redirect URL.

With these set, `proxy.ts` protects the app routes, reads go straight to Supabase under RLS, and every write goes through a validated API route under `app/api`.

### Optional settings

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ENABLE_SIMULATOR=true` | Shows the simulator in a Supabase-backed production build (staging only). It can only target devices paired with a `SIM-` ID. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push while the app is closed. Generate keys with `npx web-push generate-vapid-keys`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Inbox used by Support → Report a problem. |

## Deploying to Vercel

1. Push the repo and import it in Vercel. The framework is detected automatically; no `vercel.json` is needed.
2. Add the environment variables above under Project → Settings → Environment Variables.
3. Deploy. `/api/health` returns `{ mode, simulator }` so you can confirm the configuration.

A deployment without Supabase variables works as a public demo, with all data stored in each visitor's browser.

## Architecture

```
app/                    Routes. (app)/ is the authenticated shell; api/ holds the server endpoints
components/             UI: ui/ primitives, illustrations/, feature folders, providers/
hooks/                  useCommand, useNow, useNotificationPermission
lib/domain/             Pure domain logic: event processor, quiet hours, commands, permissions
lib/backend/            DropinService (all state changes), Store/Gateway ports, zod schemas
lib/client/             DropinClient interface + DemoClient (browser) + SupabaseDropinClient
lib/server/             API helpers, Supabase admin Store, rate limiting, web push
lib/hardware/           Device gateways (simulated / firmware queue) and camera abstraction
lib/simulation/         Builds the same normalized events as firmware would send
supabase/migrations/    SQL schema, RLS, realtime, storage
types/                  Domain types (mirror the SQL schema)
```

**How state changes:** the domain never writes to a database. `processDeviceEvent()` and `DropinService` return a list of mutations, and a `Store` applies them. `LocalStore` writes to the browser; `SupabaseAdminStore` writes inside API routes after auth and membership checks. Both modes therefore behave the same way.

**Quiet hours** are enforced on the server. When a `doorbell_pressed` event comes in, the backend checks the household schedule (time-zone aware, including overnight windows) and replies `{ chime: false }` to the device. The visit is still recorded and a silent notification is still sent, and the resident can still answer and let the visitor in. The schedule is also pushed to the device (`set_quiet_hours`) so it can be enforced while offline. Devices can only *acknowledge* a schedule; they can never change it.

**Device commands are never reported as done before the device confirms them.** Commands move through `pending → sent → completed | failed | expired`. Unlocks and access decisions are rejected while the device is offline. Settings changes are queued and delivered when it reconnects.

**Security:**
- Every table has household-scoped RLS.
- Only the service role is used for writes, and only after `requireActor()` has checked the user's membership.
- Writes are validated with zod and rate-limited.
- Unlocks, access decisions, quiet-hours changes and membership changes are audited in `activities`.
- Device credentials are stored hashed and compared in constant time.
- The service worker never caches HTML, API responses or media.

See **[docs/HARDWARE_INTEGRATION.md](docs/HARDWARE_INTEGRATION.md)** for the firmware contract.

## Screens

Welcome · Login/sign-up · Onboarding (connect, pair by QR or ID, Wi-Fi, home details, done) · Home · Parcels (Expected / Received / Collected) · Parcel details · Visitors · Incoming visitor call · Live visitor view · Access request · Activity timeline · Notification centre · Device details & controls · Quiet hours · Household & members · Account · Notification settings · Appearance · Security · Support · Offline fallback.

## Known limits / next steps

- **Live video and two-way audio** use `lib/hardware/camera.ts`. Simulated devices render a generated scene marked "Simulated feed — no audio is transmitted". Real devices show "stream unavailable" until a streaming service (WHEP/WebRTC) is wired in.
- **The rate limiter** keeps its counters in memory on each server instance. For strict global limits, swap in Upstash/Redis; the signature stays the same.
- **One household per user** is surfaced in the UI. The schema already supports more.
- **Invitations** are accepted by signing up with the invited email (onboarding shows them). No invitation email is sent yet.
