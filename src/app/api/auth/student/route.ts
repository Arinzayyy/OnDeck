import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { signStudentToken, makeStudentCookie } from '@/lib/auth';
import * as crypto from 'crypto';

/**
 * POST /api/auth/student
 * Body: { student_id: string; pin: string }
 *
 * Verifies the student's PIN against the bcrypt-style hash stored in the DB.
 * We use Node's crypto to do SHA-256 comparison (simple PIN, not bcrypt, to
 * avoid native module issues on Vercel). The seed script hashes PINs the same way.
 *
 * On success, sets an HttpOnly cookie with a 30-day JWT.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.student_id || !body?.pin) {
    return NextResponse.json(
      { error: 'student_id and pin are required' },
      { status: 400 }
    );
  }

  const { student_id, pin } = body as { student_id: string; pin: string };

  // PINs are 4 digits
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: 'PIN must be 4 digits' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { data: student, error } = await db
    .from('students')
    .select('*')
    .eq('student_id', student_id.toUpperCase())
    .single();

  if (error || !student) {
    // Don't reveal whether the ID exists
    return NextResponse.json(
      { error: 'Invalid student ID or PIN' },
      { status: 401 }
    );
  }

  // Compare SHA-256(pin) against stored hash
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
  if (pinHash !== student.pin_hash) {
    return NextResponse.json(
      { error: 'Invalid student ID or PIN' },
      { status: 401 }
    );
  }

  const token = await signStudentToken({
    sub: student.id,
    student_id: student.student_id,
    name: student.name,
    program: student.program,
    cohort: student.cohort,
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
