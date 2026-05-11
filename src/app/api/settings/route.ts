import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/auth';

/**
 * GET /api/settings
 * Public: returns current settings (max_per_day, max_concurrent, auto_approve).
 */
export async function GET() {
  const db = createServerClient();

  const { data, error } = await db.from('settings').select('*').single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/settings
 * Admin-only: update one or more settings.
 * Body: { max_per_day?, max_concurrent?, auto_approve? }
 */
export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { max_per_day, max_concurrent, auto_approve } = body;

  const updates: Record<string, unknown> = {};
  if (max_per_day !== undefined) {
    if (!Number.isInteger(max_per_day) || max_per_day < 1) {
      return NextResponse.json(
        { error: 'max_per_day must be a positive integer' },
        { status: 400 }
      );
    }
    updates.max_per_day = max_per_day;
  }
  if (max_concurrent !== undefined) {
    if (!Number.isInteger(max_concurrent) || max_concurrent < 1) {
      return NextResponse.json(
        { error: 'max_concurrent must be a positive integer' },
        { status: 400 }
      );
    }
    updates.max_concurrent = max_concurrent;
  }
  if (auto_approve !== undefined) {
    updates.auto_approve = Boolean(auto_approve);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
