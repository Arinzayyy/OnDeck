import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * DELETE /api/admins/[id]
 * Admin-only. Removes an admin from the admins table (does not delete the
 * underlying Supabase Auth user, keeping the removal recoverable).
 * Guards: cannot remove yourself; cannot remove the last admin.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { id } = params;

  if (id === admin.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself.' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { count, error: countError } = await db
    .from('admins')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (count !== null && count <= 1) {
    return NextResponse.json(
      { error: 'Cannot remove the last admin.' },
      { status: 400 }
    );
  }

  const { error } = await db.from('admins').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
