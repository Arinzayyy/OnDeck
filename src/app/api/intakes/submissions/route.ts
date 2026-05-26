import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest, getStudentFromRequest } from '@/lib/auth';

async function authorize(req: NextRequest): Promise<boolean> {
  const admin = await getAdminFromRequest(req);
  if (admin) return true;
  const student = await getStudentFromRequest(req);
  return student?.roles?.includes('front_desk') === true;
}

/**
 * GET /api/intakes/submissions
 * Auth: admin or front desk student
 * Returns unexpired submissions newest-first, with form fields joined.
 * Also opportunistically deletes expired rows before querying.
 */
export async function GET(req: NextRequest) {
  const ok = await authorize(req);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient();
  const now = new Date().toISOString();

  // Opportunistic cleanup of expired rows
  await db.from('intake_submissions').delete().lte('expires_at', now);

  const { data, error } = await db
    .from('intake_submissions')
    .select('id, form_id, submission, submitted_at, expires_at, intake_forms(fields)')
    .gt('expires_at', now)
    .order('submitted_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const submissions = (data ?? []).map((row) => ({
    id: row.id,
    form_id: row.form_id,
    submission: row.submission,
    submitted_at: row.submitted_at,
    expires_at: row.expires_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: (row.intake_forms as any)?.fields ?? {},
  }));

  return NextResponse.json({ submissions });
}
