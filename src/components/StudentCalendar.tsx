'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingModal } from './BookingModal';
import { ShiftDetailModal } from './ShiftDetailModal';
import { StatusBadge } from './ui/StatusBadge';
import type { Shift } from '@/lib/types';

interface StudentCalendarProps {
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

export function StudentCalendar({ shifts, weekStart }: StudentCalendarProps) {
  const router = useRouter();

  const [bookingDate, setBookingDate] = useState<string | undefined>();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const today = isoDate(new Date());

  // Group shifts by date for quick lookup
  const shiftsByDate = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  function prevWeek() {
    const d = addDays(weekStartDate, -7);
    router.push(`/student/week?w=${isoDate(d)}`);
  }

  function nextWeek() {
    const d = addDays(weekStartDate, 7);
    router.push(`/student/week?w=${isoDate(d)}`);
  }

  const monthLabel = weekStartDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Week nav header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={prevWeek}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Previous week"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-gray-800">{monthLabel}</span>
        <button
          onClick={nextWeek}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {days.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-500 uppercase">
            {DOW[d.getDay()]}
          </div>
        ))}
      </div>

      {/* Calendar row */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const dateStr = isoDate(d);
          const dayShifts = shiftsByDate[dateStr] ?? [];
          const isToday = dateStr === today;
          const isPast = dateStr < today;

          return (
            <button
              key={i}
              onClick={() => {
                if (!isPast) {
                  setBookingDate(dateStr);
                  setBookingOpen(true);
                }
              }}
              disabled={isPast}
              className={`day-cell rounded-lg p-3 text-left text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                isToday
                  ? 'border-teal-400 bg-teal-50'
                  : isPast
                  ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                  : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50'
              }`}
            >
              <div
                className={`text-lg font-semibold leading-none mb-1 ${
                  isToday ? 'text-teal-600' : 'text-gray-800'
                }`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayShifts.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedShift(s);
                    }}
                    className={`rounded px-1 py-0.5 text-xs font-medium truncate cursor-pointer ${
                      s.status === 'approved'
                        ? 'bg-teal-100 text-teal-800'
                        : s.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : s.status === 'cancelled'
                        ? 'bg-red-100 text-red-700 line-through'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {s.start_time} {s.clinic.split(' ').pop()}
                  </div>
                ))}
                {dayShifts.length > 3 && (
                  <div className="text-xs text-gray-400">+{dayShifts.length - 3}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modals */}
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        defaultDate={bookingDate}
      />
      {selectedShift && (
        <ShiftDetailModal
          open={!!selectedShift}
          onClose={() => setSelectedShift(null)}
          shift={selectedShift}
          isAdmin={false}
        />
      )}
    </>
  );
}
