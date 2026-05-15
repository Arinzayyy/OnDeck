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
  email: string;
  program: string;
  cohort: string;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  studentId?: string;
  email?: string;
  password?: string;
  program?: string;
  cohort?: string;
}

interface SuccessData {
  row: StudentRow;
  email: string;
  password: string;
}

function generatePassword(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let pw = '';
  for (let i = 0; i < 12; i++) pw += charset[arr[i] % charset.length];
  return pw;
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  studentId: '',
  email: '',
  program: '',
  cohort: '',
};

export function AddStudentModal({ open, onClose, onAdded }: AddStudentModalProps) {
  const { toast } = useToast();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [password, setPassword] = useState<string>(() => generatePassword());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setPassword(generatePassword());
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

    if (password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters.' });
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
          email: form.email,
          password,
          program: form.program,
          cohort: form.cohort,
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
          auth_id: data.student.auth_id ?? null,
          email: data.student.email ?? null,
          shift_counts: { total: 0, pending: 0, approved: 0, cancelled: 0, called_out: 0 },
        };
        setSuccess({ row: newRow, email: data.student.email, password });
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
      await navigator.clipboard.writeText(`Email: ${success.email}\nPassword: ${success.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
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
              Share these sign-in details privately. They can change their password from the Profile page after first login.
            </p>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-600 mb-0.5">Email</p>
                <p className="font-mono text-base font-bold text-teal-700 break-all">{success.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-600 mb-0.5">Password</p>
                <p className="font-mono text-lg font-bold text-teal-700">{success.password}</p>
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

            {/* Email */}
            <div>
              <label htmlFor="as-email" className="mb-1 block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="as-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                required
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  errors.email
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                }`}
                placeholder="jane@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="e.g. Nursing"
                />
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="e.g. Spring 2026"
                />
              </div>
            </div>

            {/* Temporary password */}
            <div>
              <label htmlFor="as-pw" className="mb-1 block text-sm font-medium text-gray-700">
                Temporary password <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="as-pw"
                  type="text"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                    errors.password
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generatePassword());
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-gray-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                  title="Generate a new password"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
              <p className="mt-1.5 text-xs text-gray-400">
                Share this with the student privately — they can change it from their Profile page after first login.
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
