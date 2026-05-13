'use client';

import { ReactNode } from 'react';

export interface GridCell {
  date: Date;
  dateStr: string;   // "YYYY-MM-DD" in local time
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;   // strictly before today
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function localIso(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function buildMonthGrid(year: number, month: number): GridCell[] {
  const now = new Date();
  const todayStr = localIso(now);

  const cells: GridCell[] = [];
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay(); // 0 = Sunday
  const lastDayNum = new Date(year, month + 1, 0).getDate();

  // Leading filler days from previous month
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, 1 - firstDow + i);
    const dateStr = localIso(d);
    cells.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === todayStr, isPast: dateStr < todayStr });
  }

  // Current month
  for (let i = 1; i <= lastDayNum; i++) {
    const d = new Date(year, month, i);
    const dateStr = localIso(d);
    cells.push({ date: d, dateStr, isCurrentMonth: true, isToday: dateStr === todayStr, isPast: dateStr < todayStr });
  }

  // Trailing filler days to complete last row
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    const d = new Date(year, month + 1, i);
    const dateStr = localIso(d);
    cells.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === todayStr, isPast: dateStr < todayStr });
  }

  return cells;
}

interface MonthGridProps {
  year: number;
  month: number;  // 0-indexed
  onPrev: () => void;
  onNext: () => void;
  renderCell: (cell: GridCell) => ReactNode;
}

export function MonthGrid({ year, month, onPrev, onNext, renderCell }: MonthGridProps) {
  const cells = buildMonthGrid(year, month);
  const label = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-gray-800">{label}</span>
        <button
          onClick={onNext}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium uppercase text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => (
          <div key={i}>{renderCell(cell)}</div>
        ))}
      </div>
    </>
  );
}
