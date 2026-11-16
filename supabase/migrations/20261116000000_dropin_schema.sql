-- ════════════════════════════════════════════════════════════════════════════
-- Dropin — core schema
-- Households own devices, parcels, visitors, activity and settings. Every
-- table is protected by Row Level Security scoped to household membership.
-- Hardware-originated writes happen only through the API (service role).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type public.member_role as enum ('owner', 'admin', 'resident');
create type public.device_type as enum ('parcel_collector', 'video_doorbell', 'indoor_monitor');
create type public.connection_status as enum ('online', 'offline', 'pending', 'error');
create type public.compartment_status as enum ('empty', 'occupied', 'error');
create type public.door_status as enum ('open', 'closed');
create type public.lock_status as enum ('locked', 'unlocked');
create type public.camera_status as enum ('ready', 'streaming', 'offline');
create type public.parcel_status as enum ('expected', 'received', 'collected');
create type public.visitor_request_type as enum ('doorbell', 'building_entry', 'parcel_delivery', 'leave_parcel');
create type public.visitor_status as enum ('detected', 'ringing', 'answered', 'pending', 'approved', 'denied', 'declined', 'missed', 'ended');
create type public.activity_category as enum ('parcels', 'visitors', 'security', 'device');
create type public.command_status as enum ('pending', 'sent', 'completed', 'failed', 'expired');
create type public.event_processing_status as enum ('received', 'processed', 'duplicate', 'failed');

-- ─── Profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  email text not null,
  phone text check (char_length(phone) <= 24),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Households & membership ────────────────────────────────────────────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  flat_number text,
  building text,
  address text,
  timezone text not null default 'UTC',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'resident',
  permissions jsonb not null default '{"can_unlock":true,"can_manage_access":true,"can_view_camera":true,"can_manage_device":false}',
  notification_prefs jsonb not null default '{"parcels":true,"visitors":true,"device":true,"security":true,"quiet_mode":"silent","browser_push":false}',
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.member_role not null default 'resident' check (role <> 'owner'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index household_invitations_pending_uniq on public.household_invitations (household_id, email) where status = 'pending';
create index household_invitations_email_idx on public.household_invitations (email) where status = 'pending';

-- ─── Devices ────────────────────────────────────────────────────────────────
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  device_name text not null check (char_length(device_name) between 2 and 40),
  device_type public.device_type not null default 'parcel_collector',
  device_identifier text not null unique check (device_identifier ~ '^(DRP|SIM)-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  -- SHA-256 of the device's factory pairing code. Never exposed to clients (see column grants below).
  device_secret_hash text not null,
  connection_status public.connection_status not null default 'pending',
  firmware_version text,
  wifi_ssid text,
  wifi_signal smallint check (wifi_signal between 0 and 100),
  doorbell_volume smallint not null default 70 check (doorbell_volume between 0 and 100),
  doorbell_enabled boolean not null default true,
  is_simulated boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index devices_household_idx on public.devices (household_id);

create table public.device_states (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique references public.devices (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  compartment_status public.compartment_status not null default 'empty',
  door_status public.door_status not null default 'closed',
  lock_status public.lock_status not null default 'locked',
  camera_status public.camera_status not null default 'ready',
  door_opened_at timestamptz,
  last_deposit_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Denormalise household_id onto device_states so Realtime can filter on it.
create or replace function public.device_states_set_household()
returns trigger language plpgsql as $$
begin
  select household_id into new.household_id from public.devices where id = new.device_id;
  return new;
end $$;
create trigger device_states_household before insert or update of device_id on public.device_states
  for each row execute function public.device_states_set_household();

-- Normalized hardware events (idempotent on event_id).
create table public.device_events (
  event_id text primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  event_type text not null,
  timestamp timestamptz not null,
  metadata jsonb not null default '{}',
  processing_status public.event_processing_status not null default 'received',
  error text,
  received_at timestamptz not null default now()
);
create index device_events_device_idx on public.device_events (device_id, timestamp desc);

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  command_type text not null check (command_type in ('unlock_compartment','lock_compartment','enable_doorbell','disable_doorbell','set_doorbell_volume','set_quiet_hours','restart_device','grant_access','deny_access')),
  payload jsonb not null default '{}',
  status public.command_status not null default 'pending',
  error text,
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index device_commands_pending_idx on public.device_commands (device_id, status, created_at);
create index device_commands_household_idx on public.device_commands (household_id, created_at desc);

-- ─── Parcels ────────────────────────────────────────────────────────────────
create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  courier_name text,
  sender text,
  tracking_number text,
  weight_kg numeric(6, 2) check (weight_kg > 0),
  image_url text,
  status public.parcel_status not null default 'expected',
  source text not null default 'manual' check (source in ('manual', 'device')),
  expected_at timestamptz,
  deposited_at timestamptz,
  collected_at timestamptz,
  collected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (status <> 'received' or deposited_at is not null),
  check (status <> 'collected' or collected_at is not null)
);
create index parcels_household_status_idx on public.parcels (household_id, status, created_at desc);
create index parcels_tracking_idx on public.parcels (household_id, tracking_number) where tracking_number is not null;

-- ─── Visitors ───────────────────────────────────────────────────────────────
create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  visitor_name text,
  image_url text,
  request_type public.visitor_request_type not null default 'doorbell',
  status public.visitor_status not null default 'ringing',
  during_quiet_hours boolean not null default false,
  chime_played boolean not null default false,
  arrived_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null
);
create index visitors_household_idx on public.visitors (household_id, arrived_at desc);

-- ─── Activity (audit trail) ─────────────────────────────────────────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  event_type text not null,
  category public.activity_category not null,
  title text not null,
  description text not null default '',
  metadata jsonb not null default '{}',
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index activities_household_idx on public.activities (household_id, created_at desc);

-- ─── Notifications ──────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  category public.activity_category not null,
  title text not null,
  description text not null default '',
  image_url text,
  action_url text,
  silent boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text not null default 'web' check (platform in ('web', 'ios', 'android')),
  user_agent text,
  created_at timestamptz not null default now()
);

-- ─── Quiet hours ────────────────────────────────────────────────────────────
create table public.quiet_hours (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  enabled boolean not null default false,
  start_time text not null default '00:00' check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null default '07:00' check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  days_of_week smallint[] not null default '{0,1,2,3,4,5,6}' check (days_of_week <@ '{0,1,2,3,4,5,6}'::smallint[]),
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  synced_at timestamptz,
  check (start_time <> end_time)
);

-- ════════════════════════════════════════════════════════════════════════════
-- Authorization helpers (security definer so policies don't recurse)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.is_household_admin(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.has_household_permission(hid uuid, perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
      and (role = 'owner' or coalesce((permissions ->> perm)::boolean, false))
  );
$$;

create or replace function public.shares_household_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- Reads: household members only. Writes: the API (service role) performs all
-- hardware-related writes after validation; residents may only update their
-- own profile and mark their own notifications as read directly.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.devices enable row level security;
alter table public.device_states enable row level security;
alter table public.device_events enable row level security;
alter table public.device_commands enable row level security;
alter table public.parcels enable row level security;
alter table public.visitors enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.quiet_hours enable row level security;

create policy "profiles: read self and housemates" on public.profiles for select
  using (id = auth.uid() or public.shares_household_with(id));
create policy "profiles: update self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "households: members read" on public.households for select using (public.is_household_member(id));
create policy "household_members: members read" on public.household_members for select using (public.is_household_member(household_id));
create policy "invitations: admins read" on public.household_invitations for select using (public.is_household_admin(household_id));

create policy "devices: members read" on public.devices for select using (public.is_household_member(household_id));
create policy "device_states: members read" on public.device_states for select
  using (exists (select 1 from public.devices d where d.id = device_id and public.is_household_member(d.household_id)));
create policy "device_events: admins read" on public.device_events for select using (public.is_household_admin(household_id));
create policy "device_commands: members read" on public.device_commands for select using (public.is_household_member(household_id));

create policy "parcels: members read" on public.parcels for select using (public.is_household_member(household_id));
-- Camera snapshots of visitors are only visible to members allowed to view the camera.
create policy "visitors: camera viewers read" on public.visitors for select using (public.has_household_permission(household_id, 'can_view_camera'));
create policy "activities: members read" on public.activities for select using (public.is_household_member(household_id));
create policy "quiet_hours: members read" on public.quiet_hours for select using (public.is_household_member(household_id));

create policy "notifications: own read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subscriptions: own" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Column-level hardening: the device secret hash is never readable by clients,
-- and residents can only change read_at on notifications.
revoke select on public.devices from anon, authenticated;
grant select (id, household_id, device_name, device_type, device_identifier, connection_status, firmware_version, wifi_ssid, wifi_signal, doorbell_volume, doorbell_enabled, is_simulated, last_seen_at, created_at)
  on public.devices to authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Realtime
-- ════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table
  public.parcels, public.visitors, public.activities, public.notifications,
  public.devices, public.device_states, public.device_commands, public.quiet_hours,
  public.household_members, public.household_invitations;

-- ════════════════════════════════════════════════════════════════════════════
-- Storage: private bucket for camera snapshots and parcel photos.
-- Object path convention: <household_id>/<kind>/<file>. Served via signed URLs.
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('dropin-media', 'dropin-media', false)
on conflict (id) do nothing;

create policy "dropin-media: members read own household" on storage.objects for select
  using (
    bucket_id = 'dropin-media'
    and public.has_household_permission(((storage.foldername(name))[1])::uuid, 'can_view_camera')
  );
