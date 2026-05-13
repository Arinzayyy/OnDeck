import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStudentFromRequest, signStudentToken, makeStudentCookie } from '@/lib/auth';

/**
 * PATCH /api/student/profile
 * Student-only: update own name, program, and cohort.
 * Re-issues the JWT so the nav bar reflects the new name immediately.
 * Body: { firstName, lastName?, program?, cohort? }
 */
export async function PATCH(req: NextRequest) {
  const student = await getStudentFromRequest(req);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

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

  const { data, error } = await db
    .from('students')
    .update({ name, program: program || null, cohort: cohort || null })
    .eq('id', student.sub)
    .select('id, name, student_id, program, cohort')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-issue JWT with updated name so router.refresh() updates the nav
  const newToken = await signStudentToken({
    sub: student.sub,
    student_id: student.student_id,
    name,
    program: data.program ?? '',
    cohort: data.cohort ?? '',
  });

  const res = NextResponse.json({ student: data });
  res.headers.set('Set-Cookie', makeStudentCookie(newToken));
  return res;
}
