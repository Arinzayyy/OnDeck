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
 * GET /api/front-desk/notes
 * Auth: admin or front desk student.
 * Returns up to 200 notes, pinned first then newest first.
 * Each note includes can_delete computed for the requesting user.
 */
export async function GET(req: NextRequest) {
  const session = await authorize(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient();
  const { data, error } = await db
    .from('front_desk_notes')
    .select('id, body, author_name, author_kind, author_id, pinned, created_at')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notes = (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    author_name: row.author_name,
    author_kind: row.author_kind,
    pinned: row.pinned,
    created_at: row.created_at,
    can_delete:
      session.kind === 'admin' ||
      (row.author_id === session.id && row.author_kind === session.kind),
  }));

  return NextResponse.json({ notes });
}

/**
 * POST /api/front-desk/notes
 * Auth: admin or front desk student.
 * Body: { body: string, pinned?: boolean }
 */
export async function POST(req: NextRequest) {
  const session = await authorize(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const body = typeof raw.body === 'string' ? raw.body.trim() : '';
  if (!body) return NextResponse.json({ error: 'Note body cannot be empty.' }, { status: 400 });
  if (body.length > 2000) {
    return NextResponse.json({ error: 'Note body must be 2000 characters or fewer.' }, { status: 400 });
  }

  const pinned = typeof raw.pinned === 'boolean' ? raw.pinned : false;

  const db = createServerClient();
  const { data, error } = await db
    .from('front_desk_notes')
    .insert({
      body,
      pinned,
      author_id: session.id,
      author_kind: session.kind,
      author_name: session.name,
    })
    .select('id, body, author_name, author_kind, pinned, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note: { ...data, can_delete: true } }, { status: 201 });
}
