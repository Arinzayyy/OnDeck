/**
 * Admin callouts list — all callouts with student/shift details and photos.
 */
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import type { Callout } from '@/lib/types';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminCalloutsPage() {
  const db = createServerClient();

  const { data } = await db
    .from('callouts')
    .select(
      `
      *,
      student:students(id, name, student_id, program),
      shift:shifts(id, date, start_time, end_time, clinic)
    `
    )
    .order('created_at', { ascending: false });

  const callouts = (data ?? []) as Callout[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Callouts</h1>

      {callouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-gray-500">No callouts recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {callouts.map((c) => (
            <div
              key={c.id}
              className="rounded-xl bg-white px-5 py-4 shadow-sm border border-gray-100"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  {/* Student */}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {c.student?.name ?? '?'}
                    </span>
                    <span className="text-sm text-gray-400">
                      ({c.student?.student_id})
                    </span>
                  </div>

                  {/* Shift details */}
                  {c.shift && (
                    <div className="text-sm text-gray-600">
                      {new Date(c.shift.date + 'T00:00:00').toLocaleDateString(
                        'en-US',
                        { weekday: 'short', month: 'short', day: 'numeric' }
                      )}{' '}
                      · {c.shift.start_time}–{c.shift.end_time} · {c.shift.clinic}
                    </div>
                  )}

                  {/* Reason */}
                  <div className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                    {c.reason}
                  </div>

                  <div className="text-xs text-gray-400">
                    Submitted {formatDateTime(c.created_at)}
                  </div>
                </div>

                {/* Photo */}
                {c.photo_url && (
                  <a
                    href={c.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.photo_url}
                      alt="Supporting document"
                      className="h-20 w-20 rounded-xl object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                    />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
