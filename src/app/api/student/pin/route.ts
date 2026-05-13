import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { getStudentFromRequest } from '@/lib/auth';

/**
 * POST /api/student/pin
 * Student-only: verify current PIN, then update to a new one.
 * Body: { currentPin: string; newPin: string }
 */
export async function POST(req: NextRequest) {
  const student = await getStudentFromRequest(req);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const currentPin = String(body.currentPin ?? '').trim();
  const newPin = String(body.newPin ?? '').trim();

  if (!/^\d{4}$/.test(currentPin)) {
    return NextResponse.json(
      { error: 'Current PIN must be 4 digits.', field: 'currentPin' },
      { status: 400 }
    );
  }

  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json(
      { error: 'New PIN must be 4 digits.', field: 'newPin' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { data: row, error: fetchErr } = await db
    .from('students')
    .select('pin_hash')
    .eq('id', student.sub)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
  }

  const currentHash = crypto.createHash('sha256').update(currentPin).digest('hex');
  if (currentHash !== row.pin_hash) {
    return NextResponse.json(
      { error: 'Current PIN is incorrect.', field: 'currentPin' },
      { status: 401 }
    );
  }

  const newHash = crypto.createHash('sha256').update(newPin).digest('hex');

  const { error: updateErr } = await db
    .from('students')
    .update({ pin_hash: newHash })
    .eq('id', student.sub);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
