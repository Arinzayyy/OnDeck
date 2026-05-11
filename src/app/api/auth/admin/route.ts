import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { signAdminToken, makeAdminCookie } from '@/lib/auth';

/**
 * POST /api/auth/admin
 * Body: { email: string; password: string }
 *
 * Authenticates admin via Supabase Auth (email+password).
 * Verifies the user exists in the `admins` table.
 * Issues a 24h HttpOnly admin JWT cookie.
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
  const { data: authData, error: authError } =
    await db.auth.signInWithPassword({ email, password });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // Verify they're in the admins table
  const { data: adminRow, error: adminErr } = await db
    .from('admins')
    .select('id')
    .eq('id', authData.user.id)
    .single();

  if (adminErr || !adminRow) {
    return NextResponse.json(
      { error: 'Not authorized as admin' },
      { status: 403 }
    );
  }

  const token = await signAdminToken(email, authData.user.id);

  const res = NextResponse.json({ email });
  res.headers.set('Set-Cookie', makeAdminCookie(token));
  return res;
}
