'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/ui/Toast';
import type { StudentRow } from './StudentsTable';

interface EditStudentModalProps {
  open: boolean;
  student: StudentRow | null;
  onClose: () => void;
  onUpdated: (student: StudentRow) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  studentId: string;
  program: string;
  cohort: string;
  resetPin: boolean;
  pin: string;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  studentId?: string;
  program?: string;
  cohort?: string;
  pin?: string;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const idx = full.indexOf(' ');
  if (idx === -1) return { firstName: full, lastName: '' };
  return { firstName: full.slice(0, idx), lastName: full.slice(idx + 1) };
}

function randomPin(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(1000 + (arr[0] % 9000));
}

export function EditStudentModal({ open, student, onClose, onUpdated }: EditStudentModalProps) {
  const { toast } = useToast();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    studentId: '',
    program: '',
    cohort: '',
    resetPin: false,
    pin: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && student) {
      const { firstName, lastName } = splitName(student.name);
      setForm({
        firstName,
        lastName,
        studentId: student.student_id,
        program: student.program ?? '',
        cohort: student.cohort ?? '',
        resetPin: false,
        pin: '',
      });
      setErrors({});
      setTimeout(() => firstNameRef.current?.focus(), 0);
    }
  }, [open, student]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleClose() {
    if (loading) return;
    onClose();
  }

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in errors) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    setErrors({});
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        studentId: form.studentId,
        program: form.program,
        cohort: form.cohort,
      };
      if (form.resetPin) {
        body.pin = form.pin;
      }

      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        onUpdated({
          ...student,
          name: data.student.name,
          student_id: data.student.student_id,
          program: data.student.program ?? null,
          cohort: data.student.cohort ?? null,
        });
        toast(`Updated ${data.student.name}.`, 'success');
        handleClose();
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

      toast("Couldn't save changes. Please try again.", 'error');
    } catch {
      toast("Couldn't save changes. Please try again.", 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!open || !student) return null;

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
        aria-labelledby="edit-student-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="edit-student-title" className="text-lg font-semibold text-gray-900">
            Edit student
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

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* First + Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="es-first" className="mb-1 block text-sm font-medium text-gray-700">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                id="es-first"
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
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label htmlFor="es-last" className="mb-1 block text-sm font-medium text-gray-700">
                Last name
              </label>
              <input
                id="es-last"
                type="text"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  errors.lastName
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                }`}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          {/* Student ID */}
          <div>
            <label htmlFor="es-sid" className="mb-1 block text-sm font-medium text-gray-700">
              Student ID <span className="text-red-500">*</span>
            </label>
            <input
              id="es-sid"
              type="text"
              value={form.studentId}
              onChange={(e) => set('studentId', e.target.value.toUpperCase())}
              required
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                errors.studentId
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
              }`}
            />
            {errors.studentId ? (
              <p className="mt-1 text-xs text-red-600">{errors.studentId}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Changing this will affect the student&rsquo;s login.</p>
            )}
          </div>

          {/* Program + Cohort */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="es-program" className="mb-1 block text-sm font-medium text-gray-700">
                Program
              </label>
              <input
                id="es-program"
                type="text"
                value={form.program}
                onChange={(e) => set('program', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="es-cohort" className="mb-1 block text-sm font-medium text-gray-700">
                Cohort
              </label>
              <input
                id="es-cohort"
                type="text"
                value={form.cohort}
                onChange={(e) => set('cohort', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Reset PIN */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.resetPin}
                onChange={(e) => {
                  set('resetPin', e.target.checked);
                  if (!e.target.checked) set('pin', '');
                }}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-gray-700">Reset this student&rsquo;s PIN</span>
            </label>
            {form.resetPin && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="es-pin" className="text-sm font-medium text-gray-700">
                    New PIN <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      set('pin', randomPin());
                      if (errors.pin) setErrors((p) => ({ ...p, pin: undefined }));
                    }}
                    className="text-xs text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Generate
                  </button>
                </div>
                <input
                  id="es-pin"
                  type="text"
                  value={form.pin}
                  onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  required={form.resetPin}
                  className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                    errors.pin
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                  placeholder="4 digits"
                />
                {errors.pin && <p className="mt-1 text-xs text-red-600">{errors.pin}</p>}
              </div>
            )}
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
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
