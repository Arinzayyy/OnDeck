import { redirect } from 'next/navigation';
import { getStudentFromCookies, getAdminFromCookies } from '@/lib/auth';
import { StudentNav } from '@/components/StudentNav';

export default async function FrontDeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admins have their own dedicated page
  const admin = await getAdminFromCookies();
  if (admin) redirect('/admin/front-desk');

  const student = await getStudentFromCookies();
  if (!student || !student.roles?.includes('front_desk')) redirect('/');

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentNav student={student} />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
