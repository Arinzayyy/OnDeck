import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = req.nextUrl.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date parameter' }, { status: 400 });
  }

  const db = createServerClient();

  const { data: shiftRows } = await db
    .from('shifts')
    .select('id')
    .eq('date', date);

  const shiftIds = (shiftRows ?? []).map((s) => s.id);

  if (shiftIds.length === 0) {
    return NextResponse.json({ ok: true, deletedShifts: 0, deletedCallouts: 0 });
  }

  const { count: calloutCount } = await db
    .from('callouts')
    .select('id', { count: 'exact', head: true })
    .in('shift_id', shiftIds);

  await db.from('shifts').delete().in('id', shiftIds);

  return NextResponse.json({
    ok: true,
    deletedShifts: shiftIds.length,
    deletedCallouts: calloutCount ?? 0,
  });
}
