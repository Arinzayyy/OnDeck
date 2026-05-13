import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { AdminMonthCalendar } from '@/components/AdminMonthCalendar';
import type { Shift } from '@/lib/types';

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  const rawM = searchParams.m;
  if (rawM && /^\d{4}-\d{2}$/.test(rawM)) {
    const parts = rawM.split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1;
  }

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const db = createServerClient();
  const { data } = await db
    .from('shifts')
    .select('*, student:students(id, name, student_id)')
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date')
    .order('start_time');

  const shifts = (data ?? []) as Shift[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Master Calendar</h1>
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <AdminMonthCalendar shifts={shifts} year={year} month={month} />
      </div>
    </div>
  );
}
