import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * POST /api/approvals/[id]
 * Admin-only: approve or reject a pending shift.
 * Body: { action: 'approve' | 'reject' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body as { action: string };

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { data: shift, error: fetchErr } = await db
    .from('shifts')
    .select('id, status')
    .eq('id', params.id)
    .single();

  if (fetchErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  }

  if (shift.status !== 'pending') {
    return NextResponse.json(
      { error: `Shift is already "${shift.status}", not pending` },
      { status: 400 }
    );
  }

  const newStatus = action === 'approve' ? 'approved' : 'cancelled';

  const { data, error } = await db
    .from('shifts')
    .update({ status: newStatus })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
