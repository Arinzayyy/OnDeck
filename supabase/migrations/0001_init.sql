-- OnDeck schema
-- Run via: supabase db push  (or paste into Supabase SQL editor)

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Students ─────────────────────────────────────────────────────────────────
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  student_id  text not null unique,     -- e.g. "S001"
  program     text not null,            -- e.g. "Dental Hygiene Year 2"
  cohort      text not null,            -- e.g. "2025"
  pin_hash    text not null,            -- bcrypt hash of 4-digit PIN
  created_at  timestamptz not null default now()
);

-- ─── Settings (single-row config) ────────────────────────────────────────────
create table if not exists settings (
  id              int primary key default 1 check (id = 1),  -- enforces single row
  max_per_day     int not null default 3,
  max_concurrent  int not null default 2,
  auto_approve    boolean not null default false,
  updated_at      timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;

-- ─── Shifts ───────────────────────────────────────────────────────────────────
create table if not exists shifts (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  date            date not null,
  start_time      text not null,   -- "09:00"
  end_time        text not null,   -- "12:00"
  clinic          text not null,
  notes           text,
  status          text not null default 'pending'
                    check (status in ('pending','approved','cancelled','called_out')),
  override_cap    boolean not null default false,  -- admin bypassed cap check
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists shifts_student_id_idx on shifts(student_id);
create index if not exists shifts_date_idx on shifts(date);
create index if not exists shifts_status_idx on shifts(status);

-- ─── Callouts ─────────────────────────────────────────────────────────────────
create table if not exists callouts (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid not null references shifts(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  reason      text not null,
  photo_url   text,                -- optional photo stored in Supabase Storage
  created_at  timestamptz not null default now()
);

create index if not exists callouts_shift_id_idx on callouts(shift_id);
create index if not exists callouts_student_id_idx on callouts(student_id);

-- ─── Admins (Supabase Auth users flagged as admins) ──────────────────────────
-- We rely on Supabase Auth for admin login. This table links auth.users to
-- an "is_admin" flag so we can verify on the server without exposing the
-- service role key to the client.
create table if not exists admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- All mutations go through server-side API routes using the service role key,
-- so we enable RLS but keep policies permissive for the service role.
alter table students       enable row level security;
alter table shifts         enable row level security;
alter table callouts       enable row level security;
alter table settings       enable row level security;
alter table admins         enable row level security;

-- Service role bypasses RLS by design in Supabase (no policy needed).
-- These policies allow the anon key to read public-safe data if needed,
-- but we never expose the anon key for writes.

-- Allow anon reads on settings (used client-side for display)
create policy "settings_read" on settings for select using (true);

-- Allow an authenticated admin user to read their OWN row in admins.
-- This is required because the admin login route uses the same Supabase client
-- for signInWithPassword AND the subsequent admins lookup. After signInWithPassword
-- the client is scoped to the user's JWT, which would otherwise hit RLS with no
-- matching policy and return zero rows.
drop policy if exists "admins_self_read" on admins;
create policy "admins_self_read"
  on admins
  for select
  using (auth.uid() = id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shifts_updated_at
  before update on shifts
  for each row execute function update_updated_at();

create trigger settings_updated_at
  before update on settings
  for each row execute function update_updated_at();
