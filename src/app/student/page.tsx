import { getStudentFromCookies } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { StudentMonthCalendar } from '@/components/StudentMonthCalendar';
import type { Shift, Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const student = await getStudentFromCookies();
  if (!student) return null;

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

  const [
    { data: myShiftsData },
    { data: allShiftsData },
    { data: activeData },
    { data: settingsData },
  ] = await Promise.all([
    db
      .from('shifts')
      .select('*')
      .eq('student_id', student.sub)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date')
      .order('start_time'),
    db
      .from('shifts')
      .select('date')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .in('status', ['pending', 'approved']),
    db
      .from('shifts')
      .select('start_time, end_time')
      .eq('student_id', student.sub)
      .in('status', ['approved', 'pending']),
    db.from('settings').select('*').single(),
  ]);

  const myShifts = (myShiftsData ?? []) as Shift[];
  const settings = settingsData as Settings | null;
  const maxPerDay = settings?.max_per_day ?? 3;

  const allCountByDate = (allShiftsData ?? []).reduce<Record<string, number>>(
    (acc, s) => {
      acc[s.date] = (acc[s.date] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const totalHours = (activeData ?? []).reduce(
    (sum, s) => sum + shiftHours(s.start_time, s.end_time),
    0
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {student.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {student.program} · {student.cohort}
        </p>
        <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
          Total hours signed up: {totalHours.toFixed(1)}
        </span>
      </div>

      {/* Month calendar */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <StudentMonthCalendar
          myShifts={myShifts}
          allCountByDate={allCountByDate}
          maxPerDay={maxPerDay}
          year={year}
          month={month}
        />
      </div>
    </div>
  );
}
