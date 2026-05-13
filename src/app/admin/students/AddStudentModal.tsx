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
  firstName: string;
  lastName: string;
  studentId: string;
  program: string;
  cohort: string;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  studentId?: string;
  program?: string;
  cohort?: string;
  pin?: string;
}

interface SuccessData {
  row: StudentRow;
  studentId: string;
  pin: string;
}

function generatePin(): string {
  const arr = new Uint32Array(4);
  crypto.getRandomValues(arr);
  let pin = '';
  for (let i = 0; i < 4; i++) {
    pin += (arr[i] % 10).toString();
  }
  if (
    /^(\d)\1{3}$/.test(pin) ||
    pin === '1234' || pin === '4321' ||
    pin === '0123' || pin === '9876'
  ) {
    return generatePin();
  }
  return pin;
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  studentId: '',
  program: '',
  cohort: '',
};

export function AddStudentModal({ open, onClose, onAdded }: AddStudentModalProps) {
  const { toast } = useToast();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pin, setPin] = useState<string>(() => generatePin());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setPin(generatePin());
      setErrors({});
      setSuccess(null);
      setCopied(false);
      setTimeout(() => firstNameRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function handleClose() {
    if (loading) return;
    onClose();
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!/^\d{4}$/.test(pin)) {
      setErrors({ pin: 'PIN must be exactly 4 digits.' });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          studentId: form.studentId,
          program: form.program,
          cohort: form.cohort,
          pin,
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        const newRow: StudentRow = {
          id: data.student.id,
          name: data.student.name,
          student_id: data.student.student_id,
          program: data.student.program ?? null,
          cohort: data.student.cohort ?? null,
          shift_counts: { total: 0, pending: 0, approved: 0, cancelled: 0, called_out: 0 },
        };
        setSuccess({ row: newRow, studentId: data.student.student_id, pin });
        return;
      }

      if (res.status === 409 || res.status === 400) {
        const field = data.field as keyof FieldErrors | undefined;
        if (field) {
          setErrors({ [field]: data.error });
        } else {
          setErrors({ firstName: data.error });
        }
        return;
      }

      toast("Couldn't add student. Please try again.", 'error');
    } catch {
      toast("Couldn't add student. Please try again.", 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    if (success) {
      onAdded(success.row);
      toast(`Added ${success.row.name} to the roster.`, 'success');
    }
    handleClose();
  }

  async function handleCopy() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(
        `Student ID: ${success.studentId}\nPIN: ${success.pin}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && !success) handleClose();
      }}
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
            {success ? 'Student added' : 'Add student'}
          </h2>
          {!success && (
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
          )}
        </div>

        {/* Success state */}
        {success ? (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm font-medium text-gray-700">
              ✓ <span className="text-gray-900">{success.row.name}</span> has been added to the roster.
            </p>
            <p className="text-sm text-gray-500">
              Share these sign-in details with the student privately. They can change their PIN from their Profile page after first login.
            </p>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-600 mb-0.5">Student ID</p>
                <p className="font-mono text-lg font-bold text-teal-700">{success.studentId}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-600 mb-0.5">PIN</p>
                <p className="font-mono text-lg font-bold text-teal-700">{success.pin}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy details'}
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="as-first" className="mb-1 block text-sm font-medium text-gray-700">
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  id="as-first"
                  ref={firstNameRef}
                  type="text"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  required
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    errors.firstName
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                  placeholder="Jane"
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
                )}
              </div>
              <div>
                <label htmlFor="as-last" className="mb-1 block text-sm font-medium text-gray-700">
                  Last name
                </label>
                <input
                  id="as-last"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    errors.lastName
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                  placeholder="Optional"
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
                )}
              </div>
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

            {/* Program + Cohort */}
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
                  placeholder="e.g. Nursing"
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

            {/* PIN */}
            <div>
              <label htmlFor="as-pin" className="mb-1 block text-sm font-medium text-gray-700">
                PIN <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="as-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPin(v);
                    if (errors.pin) setErrors((prev) => ({ ...prev, pin: undefined }));
                  }}
                  className={`w-32 rounded-lg border px-3 py-2 font-mono text-lg tracking-widest focus:outline-none focus:ring-1 ${
                    errors.pin
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPin(generatePin());
                    if (errors.pin) setErrors((prev) => ({ ...prev, pin: undefined }));
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-gray-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                  title="Generate a new PIN"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
              </div>
              {errors.pin && (
                <p className="mt-1 text-xs text-red-600">{errors.pin}</p>
              )}
              <p className="mt-1.5 text-xs text-gray-400">
                4-digit PIN the student uses to sign in. Share it privately — they can change it from their Profile page.
              </p>
            </div>

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
        )}
      </div>
    </div>,
    document.body
  );
}
