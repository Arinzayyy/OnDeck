'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonthGrid, type GridCell } from './MonthGrid';
import { ShiftDetailModal } from './ShiftDetailModal';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import type { Shift } from '@/lib/types';

interface AdminMonthCalendarProps {
  shifts: Shift[];
  year: number;
  month: number; // 0-indexed
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-400',
  approved: 'bg-teal-500',
  cancelled: 'bg-red-400',
  called_out: 'bg-orange-400',
};

export function AdminMonthCalendar({ shifts, year, month }: AdminMonthCalendarProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [clearDate, setClearDate] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const shiftsByDate = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  function navMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    router.push(`/admin/calendar?m=${d.getFullYear()}-${mm}`);
  }

  async function handleClearDay() {
    if (!clearDate) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/shifts/by-date?date=${clearDate}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Clear failed', 'error');
      } else {
        toast(
          `Cleared ${data.deletedShifts} shift(s) and ${data.deletedCallouts} callout(s).`,
          'success'
        );
        setClearDate(null);
        router.refresh();
      }
    } finally {
      setClearing(false);
    }
  }

  function renderCell(cell: GridCell) {
    const dayShifts = shiftsByDate[cell.dateStr] ?? [];
    const hasShifts = dayShifts.length > 0;

    return (
      <div
        className={`min-h-[80px] rounded-lg p-1.5 border text-xs ${
          !cell.isCurrentMonth
            ? 'border-transparent bg-transparent opacity-30'
            : cell.isToday
            ? 'border-teal-400 bg-teal-50'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-start justify-between mb-1">
          <span
            className={`font-semibold leading-none ${
              cell.isToday ? 'text-teal-600' : 'text-gray-700'
            }`}
          >
            {cell.date.getDate()}
          </span>
          {hasShifts && cell.isCurrentMonth && (
            <button
              onClick={() => setClearDate(cell.dateStr)}
              title="Clear all shifts on this day"
              className="rounded p-0.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                <path
                  fillRule="evenodd"
                  d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {dayShifts.slice(0, 3).map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedShift(s)}
              className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-gray-100 transition-colors"
            >
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                  STATUS_DOT[s.status] ?? 'bg-gray-400'
                }`}
              />
              <span className="truncate text-gray-700">
                {s.student?.name?.split(' ')[0] ?? '?'} {s.start_time}
              </span>
            </button>
          ))}
          {dayShifts.length > 3 && (
            <div className="px-1 text-[10px] text-gray-400">
              +{dayShifts.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
  }

  const clearDayShifts = clearDate ? (shiftsByDate[clearDate] ?? []) : [];
  const clearDayLabel = clearDate
    ? new Date(clearDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <>
      <MonthGrid
        year={year}
        month={month}
        onPrev={() => navMonth(-1)}
        onNext={() => navMonth(1)}
        renderCell={renderCell}
      />

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {Object.entries(STATUS_DOT).map(([status, dot]) => (
          <div key={status} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Clear day confirmation modal */}
      <Modal
        open={clearDate !== null}
        onClose={() => setClearDate(null)}
        title="Clear all shifts?"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-5">
          This will permanently delete all{' '}
          <strong>{clearDayShifts.length}</strong> shift(s) on{' '}
          <strong>{clearDayLabel}</strong>, including any associated callouts.
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setClearDate(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleClearDay} loading={clearing}>
            Clear Day
          </Button>
        </div>
      </Modal>

      {selectedShift && (
        <ShiftDetailModal
          open
          onClose={() => setSelectedShift(null)}
          shift={selectedShift}
          isAdmin
        />
      )}
    </>
  );
}
