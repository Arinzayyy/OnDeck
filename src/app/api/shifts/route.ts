import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStudentFromRequest } from '@/lib/auth';
import { checkCapacity } from '@/lib/capacity';
import type { BookShiftBody } from '@/lib/types';

/**
 * GET /api/shifts
 * Returns the authenticated student's shifts.
 * Query params: ?status=approved&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  const student = await getStudentFromRequest(req);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const db = createServerClient();

  let query = db
    .from('shifts')
    .select('*')
    .eq('student_id', student.sub)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (status) query = query.eq('status', status);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/shifts
 * Books a new shift for the authenticated student.
 * Body: { date, start_time, end_time, clinic, notes? }
 */
export async function POST(req: NextRequest) {
  const student = await getStudentFromRequest(req);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: BookShiftBody = await req.json().catch(() => ({}));
  const { date, start_time, end_time, clinic, notes } = body;

  if (!date || !start_time || !end_time || !clinic) {
    return NextResponse.json(
      { error: 'date, start_time, end_time, and clinic are required' },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date must be YYYY-MM-DD' },
      { status: 400 }
    );
  }

  // Cannot book in the past
  if (date < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: 'Cannot book shifts in the past' },
      { status: 400 }
    );
  }

  // Capacity check
  const cap = await checkCapacity({
    studentId: student.sub,
    date,
    startTime: start_time,
    endTime: end_time,
  }).catch((err) => {
    throw new Error('Capacity check error: ' + err.message);
  });

  if (!cap.allowed) {
    const msg =
      cap.reason === 'max_per_day'
        ? `You already have ${cap.current} shift(s) on this day (max ${cap.limit})`
        : `Clinic is at capacity for this time slot (max ${cap.limit} concurrent)`;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const db = createServerClient();

  // Check if auto_approve is enabled
  const { data: settings } = await db
    .from('settings')
    .select('auto_approve')
    .single();

  const status = settings?.auto_approve ? 'approved' : 'pending';

  const { data, error } = await db
    .from('shifts')
    .insert({
      student_id: student.sub,
      date,
      start_time,
      end_time,
      clinic,
      notes: notes ?? null,
      status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
