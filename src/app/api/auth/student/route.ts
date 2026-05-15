import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { signStudentToken, makeStudentCookie } from '@/lib/auth';

/**
 * POST /api/auth/student
 * Body: { email: string; password: string }
 *
 * Authenticates a student via Supabase Auth (email + password).
 * Verifies they exist in the students table (linked by auth_id).
 * Issues a 30-day HttpOnly student JWT cookie.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: 'email and password are required' },
      { status: 400 }
    );
  }

  const { email, password } = body as { email: string; password: string };

  const db = createServerClient();

  // Sign in via Supabase Auth
  const { data: authData, error: authError } = await db.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // Verify they have a student row linked to this auth user
  const { data: student } = await db
    .from('students')
    .select('id, name, student_id, program, cohort')
    .eq('auth_id', authData.user.id)
    .single();

  if (!student) {
    return NextResponse.json(
      { error: 'Not authorized as a student' },
      { status: 403 }
    );
  }

  const token = await signStudentToken({
    sub: student.id,
    student_id: student.student_id,
    name: student.name,
    program: student.program ?? '',
    cohort: student.cohort ?? '',
  });

  const res = NextResponse.json({
    id: student.id,
    name: student.name,
    student_id: student.student_id,
    program: student.program,
    cohort: student.cohort,
  });

  res.headers.set('Set-Cookie', makeStudentCookie(token));
  return res;
}
