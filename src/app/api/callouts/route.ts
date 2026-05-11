import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStudentFromRequest, getAdminFromRequest } from '@/lib/auth';
import type { CalloutBody } from '@/lib/types';

/**
 * GET /api/callouts
 * Admin: returns all callouts with student + shift data.
 * Student: returns only their own callouts.
 */
export async function GET(req: NextRequest) {
  const student = await getStudentFromRequest(req);
  const admin = await getAdminFromRequest(req);

  if (!student && !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();

  let query = db
    .from('callouts')
    .select('*, student:students(id, name, student_id, program), shift:shifts(*)')
    .order('created_at', { ascending: false });

  if (student && !admin) {
    query = query.eq('student_id', student.sub);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/callouts
 * Student submits a callout for one of their approved shifts.
 * Body: { shift_id, reason, photo_base64?, photo_mime? }
 *
 * If photo_base64 is provided, it's stored in Supabase Storage and the URL
 * is saved on the callout record.
 */
export async function POST(req: NextRequest) {
  const student = await getStudentFromRequest(req);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: CalloutBody = await req.json().catch(() => ({}));
  const { shift_id, reason, photo_base64, photo_mime } = body;

  if (!shift_id || !reason) {
    return NextResponse.json(
      { error: 'shift_id and reason are required' },
      { status: 400 }
    );
  }

  const db = createServerClient();

  // Verify the shift belongs to this student and is approved
  const { data: shift, error: shiftErr } = await db
    .from('shifts')
    .select('id, student_id, status, date')
    .eq('id', shift_id)
    .single();

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  }

  if (shift.student_id !== student.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (shift.status !== 'approved') {
    return NextResponse.json(
      { error: 'Can only call out of approved shifts' },
      { status: 400 }
    );
  }

  // Check for existing callout on this shift
  const { data: existing } = await db
    .from('callouts')
    .select('id')
    .eq('shift_id', shift_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'A callout already exists for this shift' },
      { status: 409 }
    );
  }

  let photo_url: string | null = null;

  // Upload photo to Supabase Storage if provided
  if (photo_base64 && photo_mime) {
    const buffer = Buffer.from(photo_base64, 'base64');
    const ext = photo_mime.split('/')[1] ?? 'jpg';
    const path = `callouts/${student.sub}/${shift_id}.${ext}`;

    const { error: uploadErr } = await db.storage
      .from('callout-photos')
      .upload(path, buffer, {
        contentType: photo_mime,
        upsert: true,
      });

    if (!uploadErr) {
      const { data: urlData } = db.storage
        .from('callout-photos')
        .getPublicUrl(path);
      photo_url = urlData?.publicUrl ?? null;
    }
    // If upload fails, we still create the callout — just without photo
  }

  // Create callout and mark shift as called_out in a single batch
  const [calloutRes] = await Promise.all([
    db
      .from('callouts')
      .insert({
        shift_id,
        student_id: student.sub,
        reason,
        photo_url,
      })
      .select()
      .single(),
    db
      .from('shifts')
      .update({ status: 'called_out' })
      .eq('id', shift_id),
  ]);

  if (calloutRes.error) {
    return NextResponse.json({ error: calloutRes.error.message }, { status: 500 });
  }

  return NextResponse.json(calloutRes.data, { status: 201 });
}
