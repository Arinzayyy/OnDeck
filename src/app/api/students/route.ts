import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * GET /api/students
 * Admin-only: returns all students with their shift counts.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('students')
    .select(
      `
      id, name, student_id, program, cohort, created_at,
      shifts(status)
    `
    )
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Summarize shift counts per student
  const students = (data ?? []).map((s) => {
    const shifts = (s.shifts as { status: string }[]) ?? [];
    return {
      id: s.id,
      name: s.name,
      student_id: s.student_id,
      program: s.program,
      cohort: s.cohort,
      created_at: s.created_at,
      shift_counts: {
        total: shifts.length,
        pending: shifts.filter((x) => x.status === 'pending').length,
        approved: shifts.filter((x) => x.status === 'approved').length,
        cancelled: shifts.filter((x) => x.status === 'cancelled').length,
        called_out: shifts.filter((x) => x.status === 'called_out').length,
      },
    };
  });

  return NextResponse.json(students);
}

/**
 * POST /api/students
 * Admin-only: create a new student.
 * Body: { name, studentId, program?, cohort?, pin }
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Validate name ──────────────────────────────────────────────────────────
  const name = (body.name ?? '').toString().trim();
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: 'Name must be between 2 and 80 characters.', field: 'name' },
      { status: 400 }
    );
  }

  // ── Validate studentId ─────────────────────────────────────────────────────
  const studentId = (body.studentId ?? '').toString().trim().toUpperCase();
  if (studentId.length < 2 || studentId.length > 40) {
    return NextResponse.json(
      { error: 'Student ID must be between 2 and 40 characters.', field: 'studentId' },
      { status: 400 }
    );
  }

  // ── Validate pin ───────────────────────────────────────────────────────────
  const pin = (body.pin ?? '').toString().trim();
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: 'PIN must be exactly 4 digits.', field: 'pin' },
      { status: 400 }
    );
  }

  // ── Validate optional fields ───────────────────────────────────────────────
  const program = (body.program ?? '').toString().trim();
  if (program.length > 60) {
    return NextResponse.json(
      { error: 'Program must be 60 characters or fewer.', field: 'program' },
      { status: 400 }
    );
  }

  const cohort = (body.cohort ?? '').toString().trim();
  if (cohort.length > 40) {
    return NextResponse.json(
      { error: 'Cohort must be 40 characters or fewer.', field: 'cohort' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  // ── Case-insensitive uniqueness check ─────────────────────────────────────
  // Postgres ILIKE for case-insensitive match
  const { data: existing } = await db
    .from('students')
    .select('id')
    .ilike('student_id', studentId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'A student with this ID already exists.', field: 'studentId' },
      { status: 409 }
    );
  }

  // ── Insert ─────────────────────────────────────────────────────────────────
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

  const { data, error } = await db
    .from('students')
    .insert({
      name,
      student_id: studentId,
      program: program || null,
      cohort: cohort || null,
      pin_hash: pinHash,
    })
    .select('id, name, student_id, program, cohort')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ student: data }, { status: 201 });
}
