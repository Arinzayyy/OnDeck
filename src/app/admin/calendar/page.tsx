/**
 * Admin master calendar — weekly view of all shifts across all students.
 */
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { AdminCalendar } from '@/components/AdminCalendar';
import type { Shift } from '@/lib/types';

function getMondayOf(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { w?: string };
}) {
  const rawW = searchParams.w;
  let weekStart: string;
  if (rawW && /^\d{4}-\d{2}-\d{2}$/.test(rawW)) {
    weekStart = rawW;
  } else {
    weekStart = getMondayOf(new Date());
  }

  const weekEnd = (() => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  const db = createServerClient();
  const { data } = await db
    .from('shifts')
    .select('*, student:students(id, name, student_id)')
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date')
    .order('start_time');

  const shifts = (data ?? []) as Shift[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Master Calendar</h1>
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <AdminCalendar shifts={shifts} weekStart={weekStart} />
      </div>
    </div>
  );
}
