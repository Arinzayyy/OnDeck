import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/students/[id]/activate
 * Admin-only: create a Supabase Auth user for a legacy student (no auth_id yet)
 * and link it to their existing student row.
 * Body: { email: string; password: string }
 */
export async function POST(
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

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'A valid email is required.', field: 'email' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.', field: 'password' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { data: student } = await db
    .from('students')
    .select('id, auth_id')
    .eq('id', params.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
  }

  if (student.auth_id) {
    return NextResponse.json(
      { error: 'Student already has an active sign-in account.' },
      { status: 409 }
    );
  }

  // Create the Supabase Auth user
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

  // Link auth user to the student row
  const { error: updateError } = await db
    .from('students')
    .update({ auth_id: authData.user.id, email })
    .eq('id', params.id);

  if (updateError) {
    // Roll back: clean up the orphaned auth user
    await db.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, auth_id: authData.user.id, email });
}
