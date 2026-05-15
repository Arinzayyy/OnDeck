/**
 * Admin students page — server component that fetches the roster and passes
 * it to StudentsTable (client component) which owns the Add/Edit student flow.
 */
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { StudentsTable } from './StudentsTable';
import type { StudentRow } from './StudentsTable';

export default async function AdminStudentsPage() {
  const db = createServerClient();

  const { data } = await db
    .from('students')
    .select('id, name, student_id, program, cohort, auth_id, email, shifts(status)')
    .order('name');

  const students: StudentRow[] = (data ?? []).map((s) => {
    const shifts = (s.shifts as { status: string }[]) ?? [];
    return {
      id: s.id,
      name: s.name,
      student_id: s.student_id,
      program: s.program ?? null,
      cohort: s.cohort ?? null,
      auth_id: s.auth_id ?? null,
      email: s.email ?? null,
      shift_counts: {
        total: shifts.length,
        pending: shifts.filter((x) => x.status === 'pending').length,
        approved: shifts.filter((x) => x.status === 'approved').length,
        cancelled: shifts.filter((x) => x.status === 'cancelled').length,
        called_out: shifts.filter((x) => x.status === 'called_out').length,
      },
    };
  });

  return (
    <div className="space-y-6">
      <StudentsTable initial={students} />
    </div>
  );
}
