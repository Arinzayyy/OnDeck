'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill fields (from calendar cell click or OCR import) */
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultClinic?: string;
  defaultNotes?: string;
}

const CLINICS = [
  'Clinic A',
  'Clinic B',
  'Clinic C',
  'Restorative Lab',
  'Ortho Suite',
  'Oral Surgery',
  'Radiology',
  'Periodontics',
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0');
  return [`${h}:00`, `${h}:30`];
}).flat();

export function BookingModal({
  open,
  onClose,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  defaultClinic,
  defaultNotes,
}: BookingModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    date: defaultDate ?? '',
    start_time: defaultStartTime ?? '09:00',
    end_time: defaultEndTime ?? '12:00',
    clinic: defaultClinic ?? CLINICS[0],
    notes: defaultNotes ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Re-initialize form fields each time the modal opens with new defaults
  useEffect(() => {
    if (open) {
      setForm({
        date: defaultDate ?? '',
        start_time: defaultStartTime ?? '09:00',
        end_time: defaultEndTime ?? '12:00',
        clinic: defaultClinic ?? CLINICS[0],
        notes: defaultNotes ?? '',
      });
      setError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.date) {
      setError('Please select a date.');
      return;
    }

    if (form.start_time >= form.end_time) {
      setError('End time must be after start time.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to book shift');
        return;
      }

      toast(
        data.status === 'approved'
          ? 'Shift booked and auto-approved!'
          : 'Shift booked — awaiting admin approval.',
        'success'
      );
      onClose();
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Book a Shift">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            type="date"
            value={form.date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set('date', e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Start
            </label>
            <select
              value={form.start_time}
              onChange={(e) => set('start_time', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              End
            </label>
            <select
              value={form.end_time}
              onChange={(e) => set('end_time', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clinic */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Clinic
          </label>
          <select
            value={form.clinic}
            onChange={(e) => set('clinic', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {CLINICS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Any special instructions…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Book Shift
          </Button>
        </div>
      </form>
    </Modal>
  );
}
