import { NextResponse } from 'next/server';
import { clearStudentCookie, clearAdminCookie } from '@/lib/auth';

/**
 * POST /api/auth/logout
 * Clears both student and admin cookies.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append('Set-Cookie', clearStudentCookie());
  res.headers.append('Set-Cookie', clearAdminCookie());
  return res;
}
