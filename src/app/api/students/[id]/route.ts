import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * PATCH /api/students/[id]
 * Admin-only: edit any profile field on a student record and optionally reset their password.
 * Body: { firstName, lastName?, studentId, program?, cohort?, newPassword? }
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

  // ── Validate kind if provided ───────────────────────────────────────────────
  const ALLOWED_KINDS = ['student', 'staff'] as const;
  let kind: string | undefined;
  if (body.kind !== undefined) {
    const k = String(body.kind);
    if (!ALLOWED_KINDS.includes(k as typeof ALLOWED_KINDS[number])) {
      return NextResponse.json({ error: 'Invalid kind value.' }, { status: 400 });
    }
    kind = k;
  }

  // ── Validate roles if provided ──────────────────────────────────────────────
  const ALLOWED_ROLES = ['front_desk'] as const;
  let roles: string[] | undefined;
  if (body.roles !== undefined) {
    if (!Array.isArray(body.roles)) {
      return NextResponse.json({ error: 'roles must be an array' }, { status: 400 });
    }
    for (const r of body.roles) {
      if (!ALLOWED_ROLES.includes(r as typeof ALLOWED_ROLES[number])) {
        return NextResponse.json({ error: `Unknown role: ${r}` }, { status: 400 });
      }
    }
    roles = body.roles as string[];
  }

  // ── Validate password if provided ──────────────────────────────────────────
  const newPassword = body.newPassword !== undefined
    ? String(body.newPassword).trim()
    : undefined;

  if (newPassword !== undefined && newPassword.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.', field: 'password' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  // ── Fetch student for auth_id (needed if resetting password) ──────────────
  let studentAuthId: string | null = null;
  if (newPassword !== undefined) {
    const { data: current } = await db
      .from('students')
      .select('auth_id')
      .eq('id', params.id)
      .single();
    studentAuthId = current?.auth_id ?? null;

    if (!studentAuthId) {
      return NextResponse.json(
        { error: 'This student has no sign-in account to reset the password for.', field: 'password' },
        { status: 400 }
      );
    }
  }

  // ── Check studentId uniqueness (exclude current) ───────────────────────────
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

  // ── Update profile fields ──────────────────────────────────────────────────
  const updatePayload: Record<string, unknown> = {
    name,
    student_id: studentId,
    program: program || null,
    cohort: cohort || null,
  };
  if (roles !== undefined) updatePayload.roles = roles;
  if (kind !== undefined) updatePayload.kind = kind;

  const { data, error } = await db
    .from('students')
    .update(updatePayload)
    .eq('id', params.id)
    .select('id, name, student_id, program, cohort, roles, kind')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Reset password via auth admin API ──────────────────────────────────────
  if (newPassword !== undefined && studentAuthId) {
    const { error: authUpdateError } = await db.auth.admin.updateUserById(
      studentAuthId,
      { password: newPassword }
    );

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ student: data });
}
