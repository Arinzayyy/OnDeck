/**
 * Student shift history — all shifts, filterable by status.
 */
import { getStudentFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Shift, ShiftStatus } from '@/lib/types';

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_FILTERS: { label: string; value: ShiftStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Called Out', value: 'called_out' },
];

export default async function StudentHistoryPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const student = await getStudentFromCookies();
  if (!student) return null;

  const activeFilter = searchParams.status ?? 'all';
  const db = createServerClient();

  let query = db
    .from('shifts')
    .select('*')
    .eq('student_id', student.sub)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });

  if (activeFilter !== 'all') {
    query = query.eq('status', activeFilter);
  }

  const { data } = await query;
  const shifts = (data ?? []) as Shift[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Shift History</h1>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ label, value }) => (
          <a
            key={value}
            href={value === 'all' ? '/student/history' : `/student/history?status=${value}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === value
                ? 'bg-teal-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Shift list */}
      {shifts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-gray-500">No shifts found.</p>
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
    </div>
  );
}
