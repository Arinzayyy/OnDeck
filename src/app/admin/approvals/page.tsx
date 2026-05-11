/**
 * Admin Approvals — list of pending shifts with approve/reject actions.
 */
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { ApprovalActions } from './ApprovalActions';
import type { Shift } from '@/lib/types';

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function AdminApprovalsPage() {
  const db = createServerClient();

  const { data } = await db
    .from('shifts')
    .select('*, student:students(id, name, student_id, program)')
    .eq('status', 'pending')
    .order('date')
    .order('start_time');

  const shifts = (data ?? []) as Shift[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
          {shifts.length} pending
        </span>
      </div>

      {shifts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-gray-500">All caught up — no pending shifts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-xl bg-white px-5 py-4 shadow-sm border border-gray-100 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {s.student?.name ?? '?'}
                  </span>
                  <span className="text-sm text-gray-400">
                    ({s.student?.student_id})
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-gray-600">
                  {formatDate(s.date)} · {s.start_time}–{s.end_time} · {s.clinic}
                </div>
                {s.student?.program && (
                  <div className="mt-0.5 text-xs text-gray-400">{s.student.program}</div>
                )}
                {s.notes && (
                  <div className="mt-1 text-xs text-gray-500 italic">{s.notes}</div>
                )}
              </div>
              <ApprovalActions shiftId={s.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
