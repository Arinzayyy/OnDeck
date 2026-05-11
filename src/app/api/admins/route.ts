import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * GET /api/admins
 * Admin-only. Returns all admins ordered by created_at asc, plus the
 * requesting admin's own id so the client can disable the self-remove button.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('admins')
    .select('id, email, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ admins: data, currentAdminId: admin.id });
}

/**
 * POST /api/admins
 * Admin-only. Creates a new Supabase Auth user and inserts them into the
 * admins table. The new admin can sign in immediately.
 * Body: { email: string; password: string }
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const rawEmail = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!rawEmail || !emailRegex.test(rawEmail)) {
    return NextResponse.json(
      { error: 'A valid email is required.', field: 'email' },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.', field: 'password' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { data, error } = await db.auth.admin.createUser({
    email: rawEmail,
    password,
    email_confirm: true,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (error as any).code ?? '';
    if (
      code === 'email_exists' ||
      msg.includes('already registered') ||
      msg.includes('already been registered') ||
      msg.includes('user already exists')
    ) {
      return NextResponse.json(
        { error: 'An account with this email already exists.', field: 'email' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: adminRow, error: insertError } = await db
    .from('admins')
    .insert({ id: data.user.id, email: rawEmail })
    .select('id, email, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ admin: adminRow }, { status: 201 });
}
