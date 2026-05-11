'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShiftDetailModal } from './ShiftDetailModal';
import type { Shift } from '@/lib/types';

interface AdminCalendarProps {
  shifts: Shift[];
  /** ISO YYYY-MM-DD of first day of the displayed week */
  weekStart: string;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-400',
  approved: 'bg-teal-500',
  cancelled: 'bg-red-400',
  called_out: 'bg-orange-400',
};

export function AdminCalendar({ shifts, weekStart }: AdminCalendarProps) {
  const router = useRouter();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const today = isoDate(new Date());

  const shiftsByDate = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  function prevWeek() {
    router.push(`/admin/calendar?w=${isoDate(addDays(weekStartDate, -7))}`);
  }
  function nextWeek() {
    router.push(`/admin/calendar?w=${isoDate(addDays(weekStartDate, 7))}`);
  }

  const monthLabel = weekStartDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Nav */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={prevWeek}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-gray-800">{monthLabel}</span>
        <button
          onClick={nextWeek}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ›
        </button>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {days.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-500 uppercase">
            {DOW[d.getDay()]}
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const dateStr = isoDate(d);
          const dayShifts = shiftsByDate[dateStr] ?? [];
          const isToday = dateStr === today;

          return (
            <div
              key={i}
              className={`day-cell rounded-lg p-3 border ${
                isToday ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div
                className={`text-lg font-semibold leading-none mb-1 ${
                  isToday ? 'text-teal-600' : 'text-gray-400'
                }`}
              >
                {d.getDate()}
              </div>

              {dayShifts.length === 0 && (
                <div className="text-xs text-gray-300">—</div>
              )}

              <div className="space-y-1">
                {dayShifts.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedShift(s)}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs text-gray-700 hover:bg-white transition-colors"
                  >
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${
                        STATUS_DOT[s.status] ?? 'bg-gray-400'
                      }`}
                    />
                    <span className="truncate leading-5">
                      {s.student?.name?.split(' ')[0] ?? '?'} {s.start_time}
                    </span>
                  </button>
                ))}
                {dayShifts.length > 4 && (
                  <div className="text-xs text-gray-400">+{dayShifts.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {Object.entries(STATUS_DOT).map(([status, dot]) => (
          <div key={status} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {selectedShift && (
        <ShiftDetailModal
          open={!!selectedShift}
          onClose={() => setSelectedShift(null)}
          shift={selectedShift}
          isAdmin={true}
        />
      )}
    </>
  );
}
