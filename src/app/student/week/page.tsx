/**
 * Student week calendar view.
 * URL: /student/week?w=YYYY-MM-DD (Monday of the week; defaults to current week)
 */
import { getStudentFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/server';
import { StudentCalendar } from '@/components/StudentCalendar';
import type { Shift } from '@/lib/types';

function getMondayOf(d: Date): string {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export default async function StudentWeekPage({
  searchParams,
}: {
  searchParams: { w?: string };
}) {
  const student = await getStudentFromCookies();
  if (!student) return null;

  // Parse or default to current week's Monday
  const rawW = searchParams.w;
  let weekStart: string;
  if (rawW && /^\d{4}-\d{2}-\d{2}$/.test(rawW)) {
    weekStart = rawW;
  } else {
    weekStart = getMondayOf(new Date());
  }

  // Fetch all shifts in the displayed week (Sun → Sat covers any week-start)
  const weekEnd = (() => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  const db = createServerClient();
  const { data } = await db
    .from('shifts')
    .select('*')
    .eq('student_id', student.sub)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date')
    .order('start_time');

  const shifts = (data ?? []) as Shift[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Week</h1>
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <StudentCalendar shifts={shifts} weekStart={weekStart} />
      </div>
    </div>
  );
}
