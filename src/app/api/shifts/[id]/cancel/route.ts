import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStudentFromRequest } from '@/lib/auth';

/**
 * POST /api/shifts/[id]/cancel
 * Cancels a student's own pending/approved shift.
 * Students can only cancel their own shifts, and only if status is pending or approved.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const student = await getStudentFromRequest(req);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();

  const { data: shift, error: fetchErr } = await db
    .from('shifts')
    .select('id, student_id, status')
    .eq('id', params.id)
    .single();

  if (fetchErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  }

  if (shift.student_id !== student.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['pending', 'approved'].includes(shift.status)) {
    return NextResponse.json(
      { error: `Cannot cancel a shift with status "${shift.status}"` },
      { status: 400 }
    );
  }

  const { data, error } = await db
    .from('shifts')
    .update({ status: 'cancelled' })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
