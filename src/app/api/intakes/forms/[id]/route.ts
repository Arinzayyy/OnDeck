import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * DELETE /api/intakes/forms/[id]
 * Auth: admin only
 * Soft-deletes (deactivates) an intake form so historical submissions still resolve their parent.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = createServerClient();
  const { error } = await db
    .from('intake_forms')
    .update({ active: false })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
