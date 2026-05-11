# OnDeck — Clinic Scheduling App

A full-stack clinic shift scheduling platform for dental/health programs. Students book shifts via a weekly calendar or by photographing their printed schedule (AI-powered OCR). Admins approve bookings, manage capacity, and view a master calendar.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | Supabase (Postgres + Auth + Storage) |
| Auth | Supabase Auth (admin) · Custom JWT via `jose` (student) |
| AI | Anthropic Claude (`claude-opus-4-6`) — schedule photo OCR |
| Styling | Tailwind CSS |
| Deploy | Vercel |

---

## Features

- **Student login** — 4-digit PIN + student ID, 30-day session cookie
- **Admin login** — email/password via Supabase Auth, 24h session
- **Weekly calendar** — click a day to book; view shifts colour-coded by status
- **Photo import** — upload a clinic schedule photo → Claude extracts date/time/clinic via vision API with prompt caching
- **Capacity enforcement** — configurable max-per-day (per student) + max-concurrent (clinic-wide)
- **Approval workflow** — shifts start as `pending`, admin approves/rejects; or enable auto-approve
- **Callout system** — students call out of approved shifts with a reason + optional photo upload
- **Admin dashboard** — stats, pending approvals list, master calendar, callouts log, student roster
- **Settings** — live-editable max_per_day, max_concurrent, auto_approve toggle

---

## Quick Start

### 1. Clone & install

```bash
cd ondeck-app
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migration in the SQL editor:
   ```
   supabase/migrations/0001_init.sql
   ```
   > The migration includes an RLS policy (`admins_self_read`) that allows admin users to read their own row in the `admins` table. This is required for admin login to work. If you ever see a 403 "Not authorized as admin" error after a successful password check, verify this policy exists on the `admins` table.
3. Create a Storage bucket named `callout-photos` (public)

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=<run: openssl rand -base64 32>
ADMIN_EMAIL=admin@ondeck.dev
ADMIN_PASSWORD=yourpassword
ANTHROPIC_API_KEY=          # optional — see below
```

### 4. Seed demo data

```bash
npm run seed
```

This creates 1 admin, 5 students with PINs, and 10 sample shifts.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel, set all env vars from `.env.local`
3. Deploy — no build configuration needed (Next.js auto-detected)

---

## Project Structure

```
src/
  app/
    api/
      auth/student/    POST — student login
      auth/admin/      POST — admin login
      auth/logout/     POST — clear cookies
      shifts/          GET, POST — list/book shifts
      shifts/[id]/     GET, PATCH, DELETE
      shifts/[id]/cancel/  POST
      approvals/[id]/  POST — approve or reject
      callouts/        GET, POST
      students/        GET (admin)
      settings/        GET, PATCH
      ocr/             POST — Claude vision extraction
    student/           Student pages (layout, home, week, history, callout)
    admin/             Admin pages (layout, dashboard, approvals, calendar, callouts, students, settings)
    layout.tsx         Root layout + ToastProvider
    page.tsx           Login page (redirects if authed)
  components/
    BookingModal.tsx
    ShiftDetailModal.tsx
    PhotoImportModal.tsx
    StudentCalendar.tsx
    AdminCalendar.tsx
    StudentNav.tsx
    AdminNav.tsx
    ui/  Button, Modal, Toast, StatusBadge
  lib/
    types.ts           Shared TypeScript types
    auth.ts            JWT sign/verify helpers
    capacity.ts        Capacity enforcement logic
    supabase/
      server.ts        Service-role client (server only)
      client.ts        Anon client (browser)
supabase/
  migrations/0001_init.sql
scripts/
  seed.ts
```

---

## Auth Design

**Students** authenticate with `student_id + PIN`. The PIN is stored as SHA-256 hash. On success, a 30-day HS256 JWT is issued as an `HttpOnly` cookie (`ondeck_student_token`). Server components and API routes verify it with `jose`.

**Admins** authenticate via Supabase email/password. After verification, a 24h HS256 JWT is issued as `ondeck_admin_token`. The `admins` table gates who is considered an admin beyond Supabase Auth.

---

## Capacity Logic

See `src/lib/capacity.ts`. Two rules enforced:

1. **max_per_day** — counts the student's own pending/approved shifts on the same date
2. **max_concurrent** — counts all overlapping shifts (any student) using interval intersection: `existing.start < new.end AND existing.end > new.start`

Admin can override with `override_cap: true` (marked on the shift record).

---

## Anthropic API Key (optional for v1)

`ANTHROPIC_API_KEY` is **not required** to deploy or run the app. When the key is absent:

- The app builds and starts with no errors.
- The photo-import feature works in **demo mode**: uploading any image returns a set of sample shift rows and shows a yellow banner explaining that real OCR is disabled.
- Every other feature (booking, approvals, callouts, settings) works exactly as normal.

To enable real OCR later:

1. Get a key at [console.anthropic.com](https://console.anthropic.com).
2. In Vercel: **Project → Settings → Environment Variables → Add** `ANTHROPIC_API_KEY`.
3. Redeploy (or trigger a redeployment from the Vercel dashboard).

No code changes are required — the route detects the key at runtime and switches to the Claude path automatically.

---

## Upgrading an existing deployment

If you deployed OnDeck before the admin management UI was added, run this idempotent SQL in the Supabase SQL editor to bring the schema up to date:

```sql
-- Add created_at to admins table (safe to run on existing data)
alter table admins
  add column if not exists created_at timestamptz not null default now();
```

After running this, re-deploy the app. Existing admin sessions will be invalidated (the JWT format changed to include the admin `id` claim) — admins will need to sign in once to get a fresh token.

---

## OCR Design

`POST /api/ocr` checks for `ANTHROPIC_API_KEY` at request time. If present, it sends the uploaded image to `claude-opus-4-6` with a detailed system prompt instructing it to return a JSON object with date, times, clinic, notes, confidence, and raw transcription. The system prompt uses `cache_control: {type: "ephemeral"}` so repeated uploads share the prompt cache and reduce cost. Adaptive thinking (`thinking: {type: "adaptive"}`) is enabled for highest accuracy. If the key is absent, a demo result is returned immediately with `demoMode: true`, which the modal uses to display a banner.
