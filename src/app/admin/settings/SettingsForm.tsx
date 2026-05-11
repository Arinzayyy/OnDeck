'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { Settings } from '@/lib/types';

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const { toast } = useToast();

  const [maxPerDay, setMaxPerDay] = useState(settings.max_per_day);
  const [maxConcurrent, setMaxConcurrent] = useState(settings.max_concurrent);
  const [autoApprove, setAutoApprove] = useState(settings.auto_approve);
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_per_day: maxPerDay,
          max_concurrent: maxConcurrent,
          auto_approve: autoApprove,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Save failed', 'error');
      } else {
        toast('Settings saved.', 'success');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-6"
    >
      {/* Max per day */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Max Shifts Per Day (per student)
        </label>
        <p className="mb-2 text-xs text-gray-400">
          How many shifts a single student can book on the same day.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={10}
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <span className="text-sm text-gray-500">shifts / day</span>
        </div>
      </div>

      {/* Max concurrent */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Max Concurrent Shifts (clinic-wide)
        </label>
        <p className="mb-2 text-xs text-gray-400">
          Maximum number of overlapping shifts allowed at the same time across all students.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={20}
            value={maxConcurrent}
            onChange={(e) => setMaxConcurrent(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <span className="text-sm text-gray-500">concurrent</span>
        </div>
      </div>

      {/* Auto-approve toggle */}
      <div>
        <div className="flex items-start gap-3">
          <div className="flex h-6 items-center">
            <input
              type="checkbox"
              id="auto-approve"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
          </div>
          <div>
            <label
              htmlFor="auto-approve"
              className="text-sm font-medium text-gray-700"
            >
              Auto-Approve Bookings
            </label>
            <p className="text-xs text-gray-400">
              When enabled, new shift bookings are automatically approved without
              requiring manual review.
            </p>
          </div>
        </div>
      </div>

      {/* Last updated */}
      <p className="text-xs text-gray-400">
        Last updated:{' '}
        {new Date(settings.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Save Settings
      </Button>
    </form>
  );
}
