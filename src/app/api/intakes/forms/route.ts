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
    .select('id, token, fields, accepting_until, updated_at, created_at, created_by_kind')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ forms: data ?? [] });
}

/**
 * POST /api/intakes/forms
 * Auth: admin or front desk student
 * Body: { fields: { name: bool, email: bool, address: bool, phone: bool, preferred_pharmacy: bool } }
 * Singleton model: updates fields in-place on the existing row (token never changes).
 * Only generates a new token on first-ever setup.
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

  // Look for an existing row to update (singleton — at most one)
  const { data: existing } = await db
    .from('intake_forms')
    .select('id, token')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let data;
  if (existing) {
    // Update fields in place — KEEP the existing token so the URL never changes
    const { data: updated, error: updateError } = await db
      .from('intake_forms')
      .update({
        fields,
        updated_by: auth.id,
        updated_at: new Date().toISOString(),
        active: true,
      })
      .eq('id', existing.id)
      .select('id, token, fields')
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    data = updated;
  } else {
    // First-time setup — generate a token that will never change
    const token = randomBytes(24).toString('base64url');
    const { data: inserted, error: insertError } = await db
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
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    data = inserted;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({
    ...data,
    url: `${appUrl}/intake/${data.token}`,
  });
}
