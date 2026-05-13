'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonthGrid, type GridCell } from './MonthGrid';
import { BookingModal } from './BookingModal';
import { ShiftDetailModal } from './ShiftDetailModal';
import type { Shift } from '@/lib/types';

interface StudentMonthCalendarProps {
  myShifts: Shift[];
  allCountByDate: Record<string, number>;
  maxPerDay: number;
  year: number;
  month: number; // 0-indexed
}

const STATUS_PILL: Record<string, string> = {
  approved: 'bg-teal-100 text-teal-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-700 line-through',
  called_out: 'bg-orange-100 text-orange-800',
};

export function StudentMonthCalendar({
  myShifts,
  allCountByDate,
  maxPerDay,
  year,
  month,
}: StudentMonthCalendarProps) {
  const router = useRouter();
  const [bookingDate, setBookingDate] = useState<string | undefined>();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const shiftsByDate = myShifts.reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  function navMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    router.push(`/student?m=${d.getFullYear()}-${mm}`);
  }

  function renderCell(cell: GridCell) {
    const dayShifts = shiftsByDate[cell.dateStr] ?? [];
    const total = allCountByDate[cell.dateStr] ?? 0;
    const spotsLeft = Math.max(0, maxPerDay - total);
    const isFull = spotsLeft === 0;
    const canBook = !cell.isPast && cell.isCurrentMonth && !isFull;

    return (
      <div
        onClick={() => {
          if (canBook && dayShifts.filter((s) => ['pending', 'approved'].includes(s.status)).length === 0) {
            setBookingDate(cell.dateStr);
            setBookingOpen(true);
          }
        }}
        className={`min-h-[72px] rounded-lg p-1.5 border text-xs transition-colors ${
          !cell.isCurrentMonth
            ? 'border-transparent bg-transparent opacity-30 pointer-events-none'
            : cell.isToday
            ? 'border-teal-400 bg-teal-50 cursor-pointer'
            : cell.isPast
            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-default'
            : isFull
            ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
            : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50 cursor-pointer'
        }`}
      >
        <div
          className={`font-semibold leading-none mb-1 ${
            cell.isToday ? 'text-teal-600' : 'text-gray-700'
          }`}
        >
          {cell.date.getDate()}
        </div>

        {dayShifts.slice(0, 2).map((s) => (
          <div
            key={s.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedShift(s);
            }}
            className={`mb-0.5 truncate rounded px-1 py-0.5 cursor-pointer ${
              STATUS_PILL[s.status] ?? 'bg-gray-100 text-gray-700'
            }`}
          >
            {s.start_time}
          </div>
        ))}
        {dayShifts.length > 2 && (
          <div className="text-gray-400">+{dayShifts.length - 2}</div>
        )}

        {cell.isCurrentMonth && !cell.isPast && dayShifts.filter((s) => ['pending', 'approved'].includes(s.status)).length === 0 && (
          <div className={`text-[10px] mt-0.5 ${isFull ? 'text-red-400' : 'text-gray-400'}`}>
            {isFull ? 'Full' : `${spotsLeft} open`}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <MonthGrid
        year={year}
        month={month}
        onPrev={() => navMonth(-1)}
        onNext={() => navMonth(1)}
        renderCell={renderCell}
      />
      <BookingModal
        open={bookingOpen}
        onClose={() => {
          setBookingOpen(false);
          setBookingDate(undefined);
        }}
        defaultDate={bookingDate}
      />
      {selectedShift && (
        <ShiftDetailModal
          open
          onClose={() => setSelectedShift(null)}
          shift={selectedShift}
          isAdmin={false}
        />
      )}
    </>
  );
}
