import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest, getStudentFromRequest } from '@/lib/auth';

/**
 * DELETE /api/intakes/submissions/[id]
 * Auth: admin or front desk student
 * Permanently removes a single submission.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromRequest(req);
  const student = !admin ? await getStudentFromRequest(req) : null;

  if (!admin && !student?.roles?.includes('front_desk')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = createServerClient();
  const { error } = await db
    .from('intake_submissions')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
