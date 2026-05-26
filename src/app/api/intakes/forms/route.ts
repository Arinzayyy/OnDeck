import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest, getStudentFromRequest } from '@/lib/auth';
import { randomBytes } from 'crypto';

const ALLOWED_FIELDS = ['name', 'email', 'address', 'phone', 'preferred_pharmacy'] as const;

async function authorize(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (admin) return { kind: 'admin' as const, id: admin.id };
  const student = await getStudentFromRequest(req);
  if (student?.roles?.includes('front_desk')) return { kind: 'student' as const, id: student.sub };
  return null;
}

/**
 * GET /api/intakes/forms
 * Auth: admin or front desk student
 * Returns all active intake forms, most recent first.
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient();
  const { data, error } = await db
    .from('intake_forms')
    .select('id, token, fields, created_at, created_by_kind')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ forms: data ?? [] });
}

/**
 * POST /api/intakes/forms
 * Auth: admin or front desk student
 * Body: { fields: { name: bool, email: bool, address: bool, phone: bool, preferred_pharmacy: bool } }
 * Deactivates existing active forms, creates a new one, returns the URL.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.fields || typeof body.fields !== 'object') {
    return NextResponse.json({ error: 'fields is required' }, { status: 400 });
  }

  const { fields } = body as { fields: Record<string, unknown> };

  // Only known keys allowed
  for (const key of Object.keys(fields)) {
    if (!ALLOWED_FIELDS.includes(key as typeof ALLOWED_FIELDS[number])) {
      return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 });
    }
  }

  // At least one must be enabled
  const anyEnabled = ALLOWED_FIELDS.some((k) => fields[k] === true);
  if (!anyEnabled) {
    return NextResponse.json({ error: 'Select at least one field.' }, { status: 400 });
  }

  const db = createServerClient();

  // Deactivate all existing active forms
  await db.from('intake_forms').update({ active: false }).eq('active', true);

  // Generate a random URL-safe token
  const token = randomBytes(24).toString('base64url');

  const { data, error } = await db
    .from('intake_forms')
    .insert({
      token,
      fields,
      created_by: auth.id,
      created_by_kind: auth.kind,
      active: true,
    })
    .select('id, token, fields')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({
    ...data,
    url: `${appUrl}/intake/${data.token}`,
  });
}
