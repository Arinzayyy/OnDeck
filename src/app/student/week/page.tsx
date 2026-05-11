/**
 * Student week calendar view.
 * URL: /student/week?w=YYYY-MM-DD (Monday of the week; defaults to current week)
 */
import { getStudentFromCookies } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { StudentCalendar } from '@/components/StudentCalendar';
import type { Shift } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getMondayOf(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function fmtHours(h: number): string {
  return h.toFixed(1) + ' hrs';
}

export default async function StudentWeekPage({
  searchParams,
}: {
  searchParams: { w?: string };
}) {
  const student = await getStudentFromCookies();
  if (!student) return null;

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

  // Fetch week shifts (for calendar) and all-time hours in parallel
  const [{ data: weekData }, { data: allData }] = await Promise.all([
    db
      .from('shifts')
      .select('*')
      .eq('student_id', student.sub)
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date')
      .order('start_time'),
    db
      .from('shifts')
      .select('start_time, end_time')
      .eq('student_id', student.sub)
      .in('status', ['approved', 'pending']),
  ]);

  const shifts = (weekData ?? []) as Shift[];

  const weekHours = shifts
    .filter((s) => s.status === 'approved' || s.status === 'pending')
    .reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);

  const totalHours = (allData ?? []).reduce(
    (sum, s) => sum + shiftHours(s.start_time, s.end_time),
    0
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Week</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            This week
          </p>
          <p className="mt-2 text-3xl font-bold text-teal-600">
            {fmtHours(weekHours)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Total hours signed up
          </p>
          <p className="mt-2 text-3xl font-bold text-teal-600">
            {fmtHours(totalHours)}
          </p>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <StudentCalendar shifts={shifts} weekStart={weekStart} />
      </div>
    </div>
  );
}
