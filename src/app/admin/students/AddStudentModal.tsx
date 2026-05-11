'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/ui/Toast';
import type { StudentRow } from './StudentsTable';

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: (student: StudentRow) => void;
}

interface FormState {
  name: string;
  studentId: string;
  program: string;
  cohort: string;
  pin: string;
}

interface FieldErrors {
  name?: string;
  studentId?: string;
  program?: string;
  cohort?: string;
  pin?: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  studentId: '',
  program: '',
  cohort: '',
  pin: '',
};

export function AddStudentModal({ open, onClose, onAdded }: AddStudentModalProps) {
  const { toast } = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  // Reset form and autofocus name on open
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      // Defer focus until modal is rendered
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleClose() {
    if (loading) return; // don't close mid-request
    onClose();
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          studentId: form.studentId,
          program: form.program,
          cohort: form.cohort,
          pin: form.pin,
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        // Build the StudentRow shape the table expects (new student has 0 shifts)
        const newRow: StudentRow = {
          id: data.student.id,
          name: data.student.name,
          student_id: data.student.student_id,
          program: data.student.program ?? null,
          cohort: data.student.cohort ?? null,
          shift_counts: { total: 0, pending: 0, approved: 0, cancelled: 0, called_out: 0 },
        };
        onAdded(newRow);
        toast(`Added ${data.student.name} to the roster.`, 'success');
        handleClose();
        return;
      }

      if (res.status === 409 || res.status === 400) {
        // Show inline field error if the API identified the offending field
        const field = data.field as keyof FieldErrors | undefined;
        if (field) {
          setErrors({ [field]: data.error });
        } else {
          setErrors({ name: data.error }); // fallback
        }
        return;
      }

      // 500 / network failures
      toast("Couldn't add student. Please try again.", 'error');
    } catch {
      toast("Couldn't add student. Please try again.", 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-student-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="add-student-title" className="text-lg font-semibold text-gray-900">
            Add student
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Full name */}
          <div>
            <label htmlFor="as-name" className="mb-1 block text-sm font-medium text-gray-700">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="as-name"
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.name
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
              }`}
              placeholder="Jane Smith"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Student ID */}
          <div>
            <label htmlFor="as-sid" className="mb-1 block text-sm font-medium text-gray-700">
              Student ID <span className="text-red-500">*</span>
            </label>
            <input
              id="as-sid"
              type="text"
              value={form.studentId}
              onChange={(e) => set('studentId', e.target.value.toUpperCase())}
              required
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                errors.studentId
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
              }`}
              placeholder="S006"
            />
            {errors.studentId && (
              <p className="mt-1 text-xs text-red-600">{errors.studentId}</p>
            )}
          </div>

          {/* PIN */}
          <div>
            <label htmlFor="as-pin" className="mb-1 block text-sm font-medium text-gray-700">
              4-digit PIN <span className="text-red-500">*</span>
            </label>
            <input
              id="as-pin"
              type="password"
              value={form.pin}
              onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                errors.pin
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
              }`}
              placeholder="••••"
            />
            {errors.pin && (
              <p className="mt-1 text-xs text-red-600">{errors.pin}</p>
            )}
          </div>

          {/* Program + Cohort side-by-side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="as-program" className="mb-1 block text-sm font-medium text-gray-700">
                Program
              </label>
              <input
                id="as-program"
                type="text"
                value={form.program}
                onChange={(e) => set('program', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  errors.program
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                }`}
                placeholder="e.g. Pre-med, Nursing, EMT"
              />
              {errors.program && (
                <p className="mt-1 text-xs text-red-600">{errors.program}</p>
              )}
            </div>
            <div>
              <label htmlFor="as-cohort" className="mb-1 block text-sm font-medium text-gray-700">
                Cohort
              </label>
              <input
                id="as-cohort"
                type="text"
                value={form.cohort}
                onChange={(e) => set('cohort', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  errors.cohort
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                }`}
                placeholder="e.g. Spring 2026"
              />
              {errors.cohort && (
                <p className="mt-1 text-xs text-red-600">{errors.cohort}</p>
              )}
            </div>
          </div>

          {/* Helper text */}
          <p className="text-xs text-gray-400">
            After adding, the student can sign in immediately using their Student ID and the PIN you set above.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors disabled:bg-teal-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Adding…' : 'Add student'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
