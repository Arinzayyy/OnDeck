import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest, getStudentFromRequest } from '@/lib/auth';
import { INTAKE_WINDOW_MINUTES } from '@/lib/intakes';

async function authorize(req: NextRequest): Promise<{ ok: boolean; status: 401 | 403 | null }> {
  const admin = await getAdminFromRequest(req);
  if (admin) return { ok: true, status: null };
  const student = await getStudentFromRequest(req);
  if (!student) return { ok: false, status: 401 };
  if (!student.roles?.includes('front_desk')) return { ok: false, status: 403 };
  return { ok: true, status: null };
}

/**
 * POST /api/intakes/form/window
 * Auth: admin or front desk student.
 * Body: { open: boolean }
 * Opens (sets accepting_until = now + INTAKE_WINDOW_MINUTES) or closes (sets null) the intake window.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: auth.status! });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.open !== 'boolean') {
    return NextResponse.json({ error: '`open` (boolean) is required.' }, { status: 400 });
  }

  const db = createServerClient();

  const { data: form } = await db
    .from('intake_forms')
    .select('id')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!form) {
    return NextResponse.json({ error: 'Set up your intake form first.' }, { status: 400 });
  }

  const acceptingUntil = body.open
    ? new Date(Date.now() + INTAKE_WINDOW_MINUTES * 60 * 1000).toISOString()
    : null;

  const { data: updated, error } = await db
    .from('intake_forms')
    .update({ accepting_until: acceptingUntil })
    .eq('id', form.id)
    .select('accepting_until')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ accepting_until: updated.accepting_until });
}
