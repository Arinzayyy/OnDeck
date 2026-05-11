'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { Shift } from '@/lib/types';

interface CalloutFormProps {
  eligibleShifts: Shift[];
}

function formatShift(s: Shift) {
  const d = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${d} · ${s.start_time}–${s.end_time} · ${s.clinic}`;
}

export function CalloutForm({ eligibleShifts }: CalloutFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [shiftId, setShiftId] = useState(eligibleShifts[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState(false);

  function handlePhoto(file: File) {
    if (!file.type.startsWith('image/')) return;
    setPhotoMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoPreview(dataUrl);
      setPhotoBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shiftId) {
      toast('Please select a shift.', 'error');
      return;
    }
    if (reason.trim().length < 10) {
      toast('Please provide a reason (at least 10 characters).', 'error');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { shift_id: shiftId, reason };
      if (photoBase64) {
        body.photo_base64 = photoBase64;
        body.photo_mime = photoMime;
      }

      const res = await fetch('/api/callouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Callout failed', 'error');
      } else {
        toast('Callout submitted successfully.', 'success');
        router.push('/student');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (eligibleShifts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
        <p className="text-gray-500">No eligible approved shifts to call out of.</p>
        <p className="mt-1 text-sm text-gray-400">
          Only upcoming approved shifts can be called out.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5"
    >
      {/* Shift selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Select Shift
        </label>
        <select
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {eligibleShifts.map((s) => (
            <option key={s.id} value={s.id}>
              {formatShift(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Reason */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={4}
          placeholder="Please explain why you are calling out…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
        />
      </div>

      {/* Photo upload */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Supporting Photo <span className="text-gray-400">(optional)</span>
        </label>
        {photoPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Upload preview"
              className="max-h-48 w-full rounded-xl object-contain border border-gray-200 bg-gray-50"
            />
            <button
              type="button"
              onClick={() => { setPhotoPreview(null); setPhotoBase64(null); }}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-600 shadow"
            >
              ×
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center hover:border-teal-400 hover:bg-teal-50 transition-colors"
          >
            <p className="text-sm text-gray-500">Click to upload a photo</p>
            <p className="text-xs text-gray-400">Doctor&apos;s note, etc.</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhoto(f);
          }}
        />
      </div>

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Submit Callout
      </Button>
    </form>
  );
}
