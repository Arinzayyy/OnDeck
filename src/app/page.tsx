/**
 * Root login page — shows two login cards: Student and Admin.
 * Redirects to /student or /admin if already authenticated.
 */
import { redirect } from 'next/navigation';
import { getStudentFromCookies, getAdminFromCookies } from '@/lib/auth';
import { LoginPage } from './LoginPage';

export default async function RootPage() {
  const [student, admin] = await Promise.all([
    getStudentFromCookies(),
    getAdminFromCookies(),
  ]);

  if (admin) redirect('/admin');
  if (student) redirect('/student');

  return <LoginPage />;
}
