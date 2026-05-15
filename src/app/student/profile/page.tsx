import { getStudentFromCookies } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/ProfileForm';

export const dynamic = 'force-dynamic';

export default async function StudentProfilePage() {
  const session = await getStudentFromCookies();
  if (!session) return null;

  const db = createServerClient();
  const { data: student } = await db
    .from('students')
    .select('id, name, student_id, program, cohort, auth_id')
    .eq('id', session.sub)
    .single();

  if (!student) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
      <div className="max-w-lg">
        <ProfileForm
          id={student.id}
          name={student.name}
          studentId={student.student_id}
          program={student.program}
          cohort={student.cohort}
          hasAuth={!!student.auth_id}
        />
      </div>
    </div>
  );
}
