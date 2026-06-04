import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminFromRequest, getStudentFromRequest } from '@/lib/auth';

type Session =
  | { kind: 'admin'; id: string; name: string }
  | { kind: 'student'; id: string; name: string };

async function authorize(req: NextRequest): Promise<Session | null> {
  const admin = await getAdminFromRequest(req);
  if (admin) return { kind: 'admin', id: admin.id, name: admin.email };
  const student = await getStudentFromRequest(req);
  if (student?.roles?.includes('front_desk')) {
    return { kind: 'student', id: student.sub, name: student.name };
  }
  return null;
}

/**
 * PATCH /api/front-desk/notes/[id]
 * Auth: admin or front desk student (anyone with access can pin/unpin any note).
 * Body: { pinned: boolean }
 * Updates pinned status only; body is immutable.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await authorize(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw.pinned !== 'boolean') {
    return NextResponse.json({ error: '`pinned` (boolean) is required.' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('front_desk_notes')
    .update({ pinned: raw.pinned })
    .eq('id', params.id)
    .select('id, body, author_name, author_kind, author_id, pinned, created_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });

  return NextResponse.json({
    note: {
      id: data.id,
      body: data.body,
      author_name: data.author_name,
      author_kind: data.author_kind,
      pinned: data.pinned,
      created_at: data.created_at,
      can_delete:
        session.kind === 'admin' ||
        (data.author_id === session.id && data.author_kind === session.kind),
    },
  });
}

/**
 * DELETE /api/front-desk/notes/[id]
 * Auth: admin (any note) OR original author only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await authorize(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient();

  const { data: note } = await db
    .from('front_desk_notes')
    .select('author_id, author_kind')
    .eq('id', params.id)
    .single();

  if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });

  const canDelete =
    session.kind === 'admin' ||
    (note.author_id === session.id && note.author_kind === session.kind);

  if (!canDelete) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const { error } = await db.from('front_desk_notes').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
