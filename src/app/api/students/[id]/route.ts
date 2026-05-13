import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * PATCH /api/students/[id]
 * Admin-only: edit any field on a student record and optionally reset the PIN.
 * Body: { firstName, lastName?, studentId, program?, cohort?, pin? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Validate firstName / lastName ──────────────────────────────────────────
  const firstName = String(body.firstName ?? '').trim();
  if (firstName.length < 2 || firstName.length > 40) {
    return NextResponse.json(
      { error: 'First name must be between 2 and 40 characters.', field: 'firstName' },
      { status: 400 }
    );
  }

  const lastName = String(body.lastName ?? '').trim();
  if (lastName && (lastName.length < 1 || lastName.length > 40)) {
    return NextResponse.json(
      { error: 'Last name must be between 1 and 40 characters.', field: 'lastName' },
      { status: 400 }
    );
  }

  const name = firstName + (lastName ? ' ' + lastName : '');

  // ── Validate studentId ─────────────────────────────────────────────────────
  const studentId = String(body.studentId ?? '').trim().toUpperCase();
  if (studentId.length < 2 || studentId.length > 40) {
    return NextResponse.json(
      { error: 'Student ID must be between 2 and 40 characters.', field: 'studentId' },
      { status: 400 }
    );
  }

  // ── Validate optional fields ───────────────────────────────────────────────
  const program = String(body.program ?? '').trim();
  if (program.length > 60) {
    return NextResponse.json(
      { error: 'Program must be 60 characters or fewer.', field: 'program' },
      { status: 400 }
    );
  }

  const cohort = String(body.cohort ?? '').trim();
  if (cohort.length > 40) {
    return NextResponse.json(
      { error: 'Cohort must be 40 characters or fewer.', field: 'cohort' },
      { status: 400 }
    );
  }

  // ── Validate PIN if provided ───────────────────────────────────────────────
  const rawPin = body.pin !== undefined ? String(body.pin).trim() : undefined;
  if (rawPin !== undefined && !/^\d{4}$/.test(rawPin)) {
    return NextResponse.json(
      { error: 'PIN must be exactly 4 digits.', field: 'pin' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  // ── Check studentId uniqueness (exclude this student) ─────────────────────
  const { data: collision } = await db
    .from('students')
    .select('id')
    .ilike('student_id', studentId)
    .neq('id', params.id)
    .maybeSingle();

  if (collision) {
    return NextResponse.json(
      { error: 'Another student already has this ID.', field: 'studentId' },
      { status: 409 }
    );
  }

  // ── Build update payload ───────────────────────────────────────────────────
  const updates: Record<string, unknown> = {
    name,
    student_id: studentId,
    program: program || null,
    cohort: cohort || null,
  };

  if (rawPin !== undefined) {
    updates.pin_hash = crypto.createHash('sha256').update(rawPin).digest('hex');
  }

  const { data, error } = await db
    .from('students')
    .update(updates)
    .eq('id', params.id)
    .select('id, name, student_id, program, cohort')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ student: data });
}
