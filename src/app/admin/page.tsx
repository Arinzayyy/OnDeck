/**
 * Admin Dashboard — stats overview: pending approvals, today's shifts,
 * recent callouts, total students.
 */
import Link from 'next/link';

export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/server';

export default async function AdminDashboardPage() {
  const db = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: pendingCount },
    { count: todayCount },
    { count: calledOutCount },
    { count: studentCount },
  ] = await Promise.all([
    db
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    db
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .in('status', ['approved', 'pending']),
    db
      .from('callouts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    db.from('students').select('*', { count: 'exact', head: true }),
  ]);

  const stats = [
    {
      label: 'Pending Approvals',
      value: pendingCount ?? 0,
      href: '/admin/approvals',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      label: "Today's Shifts",
      value: todayCount ?? 0,
      href: '/admin/calendar',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      label: 'Callouts (7d)',
      value: calledOutCount ?? 0,
      href: '/admin/callouts',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Total Students',
      value: studentCount ?? 0,
      href: '/admin/students',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-2xl ${s.bg} p-5 transition-opacity hover:opacity-80`}
          >
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-sm font-medium text-gray-600">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/approvals"
            className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100 transition-colors"
          >
            Review Pending Approvals →
          </Link>
          <Link
            href="/admin/calendar"
            className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors"
          >
            View Calendar →
          </Link>
          <Link
            href="/admin/settings"
            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Manage Settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
