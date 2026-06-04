import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { SUBMISSION_TTL_HOURS } from '@/lib/intakes';

// Simple in-memory rate limiter — 5 submissions/hour/IP.
// If a patient fails this many times in an hour, something's wrong (typo'd email,
// network issue, etc.) — front desk should collect the info in person instead.
const ipHits = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

const ALLOWED_FIELDS = ['name', 'email', 'address', 'phone', 'preferred_pharmacy'] as const;
type FieldKey = typeof ALLOWED_FIELDS[number];

const INACTIVE_RESPONSE = NextResponse.json(
  { error: 'This form is no longer active. Please ask the front desk for an updated link.' },
  { status: 410 }
);

/**
 * GET /api/intakes/public/[token]
 * Public — no auth required.
 * Returns only { fields } so patients know which fields to fill.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = createServerClient();
  const { data } = await db
    .from('intake_forms')
    .select('fields, active, accepting_until')
    .eq('token', params.token)
    .single();

  if (!data || !data.active) return INACTIVE_RESPONSE;

  const now = new Date();
  const acceptingUntil = data.accepting_until ? new Date(data.accepting_until) : null;
  const isOpen = acceptingUntil !== null && acceptingUntil > now;
  const closesAt = isOpen ? data.accepting_until : null;

  return NextResponse.json({ fields: data.fields, is_open: isOpen, closes_at: closesAt });
}

/**
 * POST /api/intakes/public/[token]
 * Public — no auth required.
 * Accepts patient answers, validates, inserts submission.
 * Does NOT close the form — same link reusable for every patient.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 }
    );
  }

  const db = createServerClient();

  // Re-look-up form to prevent submissions to stale forms
  const { data: form } = await db
    .from('intake_forms')
    .select('id, fields, active, accepting_until')
    .eq('token', params.token)
    .single();

  if (!form || !form.active) return INACTIVE_RESPONSE;

  // Enforce intake window — this is the security boundary
  if (!form.accepting_until || new Date(form.accepting_until) <= new Date()) {
    return NextResponse.json(
      { error: 'Intake is currently closed. Please ask the front desk to reopen it.', code: 'closed' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const formFields = form.fields as Record<FieldKey, boolean>;
  const submission: Record<string, string> = {};

  for (const key of ALLOWED_FIELDS) {
    if (!formFields[key]) continue;

    const value = String(body[key] ?? '').trim();
    if (!value) {
      return NextResponse.json({ error: `${key} is required`, field: key }, { status: 400 });
    }

    if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.', field: 'email' },
        { status: 400 }
      );
    }

    submission[key] = value;
  }

  const expiresAt = new Date(
    Date.now() + SUBMISSION_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { error } = await db.from('intake_submissions').insert({
    form_id: form.id,
    submission,
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
