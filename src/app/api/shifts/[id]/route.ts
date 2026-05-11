import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStudentFromRequest, getAdminFromRequest } from '@/lib/auth';
import { checkCapacity } from '@/lib/capacity';

/**
 * GET /api/shifts/[id]
 * Returns a single shift. Accessible by the owning student or any admin.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const student = await getStudentFromRequest(req);
  const admin = await getAdminFromRequest(req);

  if (!student && !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('shifts')
    .select('*, student:students(*)')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  }

  // Students can only see their own shifts
  if (student && !admin && data.student_id !== student.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/shifts/[id]
 * Admin-only: update shift fields or reassign to a different time slot.
 * Body: { date?, start_time?, end_time?, clinic?, notes?, status?, override_cap? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const db = createServerClient();

  const { data: existing, error: fetchErr } = await db
    .from('shifts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    date,
    start_time,
    end_time,
    clinic,
    notes,
    status,
    override_cap,
  } = body;

  // If moving the shift in time, re-run capacity check (excluding this shift)
  const newDate = date ?? existing.date;
  const newStart = start_time ?? existing.start_time;
  const newEnd = end_time ?? existing.end_time;
  const doOverride = override_cap ?? existing.override_cap ?? false;

  if (date || start_time || end_time) {
    const cap = await checkCapacity({
      studentId: existing.student_id,
      date: newDate,
      startTime: newStart,
      endTime: newEnd,
      excludeShiftId: params.id,
      overrideCap: doOverride,
    });

    if (!cap.allowed) {
      const msg =
        cap.reason === 'max_per_day'
          ? `Capacity exceeded: ${cap.current}/${cap.limit} shifts on this day`
          : `Capacity exceeded: ${cap.current}/${cap.limit} concurrent at this time`;
      return NextResponse.json({ error: msg, cap_exceeded: true }, { status: 409 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (date !== undefined) updates.date = date;
  if (start_time !== undefined) updates.start_time = start_time;
  if (end_time !== undefined) updates.end_time = end_time;
  if (clinic !== undefined) updates.clinic = clinic;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;
  if (override_cap !== undefined) updates.override_cap = override_cap;

  const { data, error } = await db
    .from('shifts')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/shifts/[id]
 * Admin-only: hard delete a shift.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const db = createServerClient();

  const { error } = await db.from('shifts').delete().eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
