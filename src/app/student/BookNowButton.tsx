'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { BookingModal } from '@/components/BookingModal';
import { PhotoImportModal } from '@/components/PhotoImportModal';
import type { OcrResult } from '@/lib/types';

/**
 * Floating "Book a Shift" button on the student home page.
 * Also provides the "Import Schedule Photo" path.
 */
export function BookNowButton() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<OcrResult>>({});

  function handleOcrImport(result: OcrResult) {
    setPrefill(result);
    setBookingOpen(true);
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPhotoOpen(true)}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Import Photo
        </Button>
        <Button onClick={() => { setPrefill({}); setBookingOpen(true); }}>
          + Book a Shift
        </Button>
      </div>

      <PhotoImportModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onImport={handleOcrImport}
      />

      {/* BookingModal with optional OCR prefill */}
      <BookingModal
        open={bookingOpen}
        onClose={() => { setBookingOpen(false); setPrefill({}); }}
        defaultDate={prefill.date ?? undefined}
        defaultStartTime={prefill.start_time ?? undefined}
        defaultEndTime={prefill.end_time ?? undefined}
        defaultClinic={prefill.clinic ?? undefined}
        defaultNotes={prefill.notes ?? undefined}
      />
    </>
  );
}
