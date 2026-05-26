-- OnDeck schema
-- Run via: supabase db push  (or paste into Supabase SQL editor)

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Students ─────────────────────────────────────────────────────────────────
-- auth_id links to a Supabase Auth user (email + password login).
-- email is the student's login email, stored here for display.
-- pin_hash is kept nullable for backward compat with legacy rows; no longer written.
-- program and cohort are nullable — they are optional at enrolment.
-- roles is a text array of additional roles (e.g. 'front_desk'); base student role is implicit.
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete set null,
  email       text unique,
  name        text not null,
  student_id  text not null unique,     -- e.g. "S001"
  program     text,
  cohort      text,
  pin_hash    text,                     -- legacy; nullable; no longer written by the app
  roles       text[] not null default '{}',
  kind        text not null default 'student' check (kind in ('student', 'staff')),
  created_at  timestamptz not null default now()
);

-- ─── Upgrade path for existing databases ─────────────────────────────────────
-- Run these once in the Supabase SQL editor if applying to a DB that already
-- has the students table from the previous schema version.
alter table students
  add column if not exists auth_id uuid unique references auth.users(id) on delete set null,
  add column if not exists email text unique,
  add column if not exists roles text[] not null default '{}',
  add column if not exists kind text not null default 'student';

do $$ begin
  alter table students add constraint students_kind_check
    check (kind in ('student', 'staff'));
exception when duplicate_object then null;
end $$;
-- Make previously-required columns nullable (they're optional at enrolment)
do $$ begin
  begin alter table students alter column pin_hash drop not null; exception when others then null; end;
  begin alter table students alter column program  drop not null; exception when others then null; end;
  begin alter table students alter column cohort   drop not null; exception when others then null; end;
end $$;

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
create table if not exists admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table students       enable row level security;
alter table shifts         enable row level security;
alter table callouts       enable row level security;
alter table settings       enable row level security;
alter table admins         enable row level security;

-- Allow anon reads on settings (used client-side for display)
create policy "settings_read" on settings for select using (true);

-- Allow an authenticated admin user to read their own row.
-- Required because the admin login route uses signInWithPassword AND the
-- subsequent admins lookup in the same client scope.
drop policy if exists "admins_self_read" on admins;
create policy "admins_self_read"
  on admins
  for select
  using (auth.uid() = id);

-- Allow an authenticated student user to read their own row.
-- Required for the student login route: after signInWithPassword the client
-- is scoped to that user's JWT, which would otherwise hit RLS with no policy.
drop policy if exists "students_self_read" on students;
create policy "students_self_read"
  on students
  for select
  using (auth.uid() = auth_id);

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

-- ─── Intake forms ─────────────────────────────────────────────────────────────
-- The reusable intake form. Typically just one active row at a time.
-- The patient-facing URL embeds this row's token.
create table if not exists intake_forms (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  fields          jsonb not null,
  created_by      uuid,
  created_by_kind text not null check (created_by_kind in ('admin', 'student')),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ─── Intake submissions ───────────────────────────────────────────────────────
-- One row per patient submission. Auto-expires so PHI doesn't linger.
create table if not exists intake_submissions (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references intake_forms(id) on delete cascade,
  submission    jsonb not null,
  submitted_at  timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists intake_forms_active_idx on intake_forms (active);
create index if not exists intake_submissions_submitted_at_idx on intake_submissions (submitted_at desc);
create index if not exists intake_submissions_form_id_idx on intake_submissions (form_id);
create index if not exists intake_submissions_expires_at_idx on intake_submissions (expires_at);

-- ─── RLS for intake tables ────────────────────────────────────────────────────
-- Server uses the service role key (bypasses RLS) for all access via API routes.
-- Enabling RLS with no policies = deny-all to anon/authenticated clients.
-- Defense in depth: if anyone ever queries these from the browser with the
-- wrong client, PHI stays locked.
alter table intake_forms       enable row level security;
alter table intake_submissions enable row level security;
