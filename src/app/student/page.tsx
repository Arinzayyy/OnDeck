/**
 * Student Home — shows upcoming approved shifts + quick-book button.
 */
import { getStudentFromCookies } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BookNowButton } from './BookNowButton';
import type { Shift } from '@/lib/types';

export const dynamic = 'force-dynamic';

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export default async function StudentHomePage() {
  const student = await getStudentFromCookies();
  if (!student) return null;

  const db = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: upcoming }, { data: allActive }] = await Promise.all([
    db
      .from('shifts')
      .select('*')
      .eq('student_id', student.sub)
      .gte('date', today)
      .in('status', ['pending', 'approved'])
      .order('date')
      .order('start_time')
      .limit(10),
    db
      .from('shifts')
      .select('start_time, end_time')
      .eq('student_id', student.sub)
      .in('status', ['approved', 'pending']),
  ]);

  const shifts = (upcoming ?? []) as Shift[];

  const totalHours = (allActive ?? []).reduce(
    (sum, s) => sum + shiftHours(s.start_time, s.end_time),
    0
  );

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between">
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
        <BookNowButton />
      </div>

      {/* Upcoming shifts */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Upcoming Shifts
        </h2>

        {shifts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="text-gray-500">No upcoming shifts.</p>
            <p className="mt-1 text-sm text-gray-400">
              Click &ldquo;Book a Shift&rdquo; to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm border border-gray-100"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {formatDate(s.date)} · {s.start_time}–{s.end_time}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500">{s.clinic}</div>
                  {s.notes && (
                    <div className="mt-0.5 text-xs text-gray-400">{s.notes}</div>
                  )}
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
