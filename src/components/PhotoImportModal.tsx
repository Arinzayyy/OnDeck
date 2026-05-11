'use client';

import { useState, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import type { OcrResult } from '@/lib/types';

interface PhotoImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user confirms the parsed result — parent prefills BookingModal */
  onImport: (result: OcrResult) => void;
}

export function PhotoImportModal({ open, onClose, onImport }: PhotoImportModalProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [base64, setBase64] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file.', 'error');
      return;
    }
    setMimeType(file.type);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      // Strip the data URL prefix to get raw base64
      setBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleExtract() {
    if (!base64) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, mime_type: mimeType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'OCR failed', 'error');
      } else {
        setResult(data as OcrResult);
      }
    } catch {
      toast('Network error during OCR', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!result) return;
    onImport(result);
    handleReset();
    onClose();
  }

  function handleReset() {
    setPreview(null);
    setBase64(null);
    setResult(null);
    setMimeType('image/jpeg');
  }

  const confidenceColor = {
    high: 'text-teal-700 bg-teal-50',
    medium: 'text-yellow-700 bg-yellow-50',
    low: 'text-red-700 bg-red-50',
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Schedule Photo" size="lg">
      <div className="space-y-5">
        {/* Upload zone */}
        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors"
          >
            <svg
              className="mb-3 h-10 w-10 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              Drop a schedule photo here, or click to select
            </p>
            <p className="mt-1 text-xs text-gray-500">JPEG, PNG, WebP up to 10 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image preview */}
            <div className="relative overflow-hidden rounded-xl border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Schedule preview"
                className="w-full max-h-64 object-contain bg-gray-100"
              />
              <button
                onClick={handleReset}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-600 shadow hover:bg-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Extract button */}
            {!result && (
              <Button
                className="w-full"
                onClick={handleExtract}
                loading={loading}
              >
                {loading ? 'Extracting with AI…' : 'Extract Shift Details'}
              </Button>
            )}
          </div>
        )}

        {/* OCR Result */}
        {result && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            {/* Demo-mode banner — shown when ANTHROPIC_API_KEY is not configured */}
            {result.demoMode && (
              <div className="flex gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"
                  />
                </svg>
                <span>
                  Demo mode — photo import is using sample data because no Anthropic
                  API key is configured. Add{' '}
                  <code className="rounded bg-yellow-100 px-1 font-mono text-xs">
                    ANTHROPIC_API_KEY
                  </code>{' '}
                  to your Vercel environment variables to enable real OCR on your
                  uploaded image.{' '}
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline hover:text-yellow-900"
                  >
                    Learn more →
                  </a>
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Extracted Details</h3>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
                  confidenceColor[result.confidence]
                }`}
              >
                {result.confidence} confidence
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Date', result.date],
                ['Start', result.start_time],
                ['End', result.end_time],
                ['Clinic', result.clinic],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-gray-500">{label}</dt>
                  <dd className={value ? 'text-gray-900' : 'text-gray-400 italic'}>
                    {value ?? 'Not found'}
                  </dd>
                </div>
              ))}
              {result.notes && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Notes</dt>
                  <dd className="text-gray-900">{result.notes}</dd>
                </div>
              )}
            </dl>

            {result.raw_text && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">Raw text</summary>
                <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-xs">
                  {result.raw_text}
                </pre>
              </details>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Try Again
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                Use These Details
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
