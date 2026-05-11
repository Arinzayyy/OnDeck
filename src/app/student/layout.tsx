import { redirect } from 'next/navigation';
import { getStudentFromCookies } from '@/lib/auth';
import { StudentNav } from '@/components/StudentNav';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const student = await getStudentFromCookies();
  if (!student) redirect('/');

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentNav student={student} />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
