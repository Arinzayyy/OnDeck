import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStudentFromRequest } from '@/lib/auth';

/**
 * POST /api/student/password
 * Student-only: verify current password, then update to a new one.
 * Body: { currentPassword: string; newPassword: string }
 */
export async function POST(req: NextRequest) {
  const session = await getStudentFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? '').trim();
  const newPassword = String(body.newPassword ?? '').trim();

  if (!currentPassword) {
    return NextResponse.json(
      { error: 'Current password is required.', field: 'currentPassword' },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters.', field: 'newPassword' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { data: row } = await db
    .from('students')
    .select('email, auth_id')
    .eq('id', session.sub)
    .single();

  if (!row?.email || !row?.auth_id) {
    return NextResponse.json(
      { error: 'Account not configured for password login.' },
      { status: 400 }
    );
  }

  // Verify current password by attempting sign-in
  const { error: signInError } = await db.auth.signInWithPassword({
    email: row.email,
    password: currentPassword,
  });

  if (signInError) {
    return NextResponse.json(
      { error: 'Current password is incorrect.', field: 'currentPassword' },
      { status: 401 }
    );
  }

  // Update via service-role admin API
  const { error: updateError } = await db.auth.admin.updateUserById(row.auth_id, {
    password: newPassword,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
