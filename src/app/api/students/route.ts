import { NextRequest, NextResponse } from 'next/server';
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
    .select('id, name, student_id, program, cohort, auth_id, email, shifts(status)')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const students = (data ?? []).map((s) => {
    const shifts = (s.shifts as { status: string }[]) ?? [];
    return {
      id: s.id,
      name: s.name,
      student_id: s.student_id,
      program: s.program,
      cohort: s.cohort,
      auth_id: s.auth_id ?? null,
      email: s.email ?? null,
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
 * Admin-only: create a new student with email + password via Supabase Auth.
 * Body: { firstName, lastName?, studentId, email, password, program?, cohort? }
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

  // ── Validate email ─────────────────────────────────────────────────────────
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'A valid email address is required.', field: 'email' },
      { status: 400 }
    );
  }

  // ── Validate password ──────────────────────────────────────────────────────
  const password = String(body.password ?? '').trim();
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.', field: 'password' },
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

  const db = createServerClient();

  // ── Check studentId uniqueness ─────────────────────────────────────────────
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

  // ── Create Supabase Auth user ──────────────────────────────────────────────
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists') || (authError as { code?: string }).code === 'email_exists') {
      return NextResponse.json(
        { error: 'An account with this email already exists.', field: 'email' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // ── Insert student row ─────────────────────────────────────────────────────
  const { data, error } = await db
    .from('students')
    .insert({
      auth_id: authData.user.id,
      email,
      name,
      student_id: studentId,
      program: program || null,
      cohort: cohort || null,
    })
    .select('id, name, student_id, program, cohort, auth_id, email')
    .single();

  if (error) {
    // Roll back: clean up the orphaned auth user
    await db.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ student: data }, { status: 201 });
}
