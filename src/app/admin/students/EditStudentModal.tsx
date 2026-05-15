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
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  studentId?: string;
  program?: string;
  cohort?: string;
  password?: string;
}

type SuccessData =
  | { type: 'activate'; email: string; password: string; authId: string }
  | { type: 'password'; password: string };

function splitName(full: string): { firstName: string; lastName: string } {
  const idx = full.indexOf(' ');
  if (idx === -1) return { firstName: full, lastName: '' };
  return { firstName: full.slice(0, idx), lastName: full.slice(idx + 1) };
}

function generatePassword(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let pw = '';
  for (let i = 0; i < 12; i++) pw += charset[arr[i] % charset.length];
  return pw;
}

export function EditStudentModal({ open, student, onClose, onUpdated }: EditStudentModalProps) {
  const { toast } = useToast();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', studentId: '', program: '', cohort: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  // Password reset (for activated students)
  const [resetPassword, setResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Activate flow (for legacy students)
  const [activateEmail, setActivateEmail] = useState('');
  const [activatePassword, setActivatePassword] = useState(() => generatePassword());
  const [activateErrors, setActivateErrors] = useState<{ email?: string; password?: string }>({});
  const [activating, setActivating] = useState(false);

  // Success / credential reveal
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && student) {
      const { firstName, lastName } = splitName(student.name);
      setForm({ firstName, lastName, studentId: student.student_id, program: student.program ?? '', cohort: student.cohort ?? '' });
      setErrors({});
      setResetPassword(false);
      setNewPassword('');
      setPwdError('');
      setActivateEmail('');
      setActivatePassword(generatePassword());
      setActivateErrors({});
      setSuccess(null);
      setCopied(false);
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
    if (loading || activating) return;
    onClose();
  }

  function set<K extends keyof FormState>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FieldErrors]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // ── Save profile (+ optional password reset) ───────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    setErrors({});
    setPwdError('');

    if (resetPassword && newPassword.length < 8) {
      setPwdError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        studentId: form.studentId,
        program: form.program,
        cohort: form.cohort,
      };
      if (resetPassword) {
        body.newPassword = newPassword;
      }

      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        const updatedRow: StudentRow = {
          ...student,
          name: data.student.name,
          student_id: data.student.student_id,
          program: data.student.program ?? null,
          cohort: data.student.cohort ?? null,
        };

        if (resetPassword) {
          onUpdated(updatedRow);
          setSuccess({ type: 'password', password: newPassword });
          return;
        }

        onUpdated(updatedRow);
        toast(`Updated ${data.student.name}.`, 'success');
        handleClose();
        return;
      }

      if (res.status === 409 || res.status === 400) {
        const field = data.field as keyof FieldErrors | undefined;
        if (field === 'password') {
          setPwdError(data.error);
        } else if (field) {
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

  // ── Activate sign-in for legacy student ────────────────────────────────────
  async function handleActivate() {
    if (!student) return;
    setActivateErrors({});

    if (!activateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(activateEmail)) {
      setActivateErrors({ email: 'A valid email is required.' });
      return;
    }
    if (activatePassword.length < 8) {
      setActivateErrors({ password: 'Password must be at least 8 characters.' });
      return;
    }

    setActivating(true);
    try {
      const res = await fetch(`/api/students/${student.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activateEmail, password: activatePassword }),
      });
      const data = await res.json();

      if (res.ok) {
        onUpdated({ ...student, auth_id: data.auth_id, email: data.email });
        setSuccess({ type: 'activate', email: data.email, password: activatePassword, authId: data.auth_id });
        return;
      }

      if (data.field) {
        setActivateErrors({ [data.field]: data.error });
      } else {
        toast(data.error ?? "Activation failed. Please try again.", 'error');
      }
    } catch {
      toast("Activation failed. Please try again.", 'error');
    } finally {
      setActivating(false);
    }
  }

  // ── Success → Done ─────────────────────────────────────────────────────────
  function handleDone() {
    if (success?.type === 'activate') {
      toast(`${student?.name} can now sign in.`, 'success');
    }
    handleClose();
  }

  async function handleCopy() {
    if (!success) return;
    try {
      const text = success.type === 'activate'
        ? `Email: ${success.email}\nPassword: ${success.password}`
        : `Password: ${success.password}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (!open || !student) return null;

  const isLegacy = !student.auth_id;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === overlayRef.current && !success) handleClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
          <h2 id="edit-student-title" className="text-lg font-semibold text-gray-900">
            {success ? 'Sign-in details' : 'Edit student'}
          </h2>
          {!success && (
            <button
              onClick={handleClose}
              disabled={loading || activating}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Success / credential reveal */}
        {success ? (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              {success.type === 'activate'
                ? 'Share these sign-in details with the student privately.'
                : "Share the new password with the student privately."}
            </p>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 space-y-3">
              {success.type === 'activate' && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-teal-600 mb-0.5">Email</p>
                  <p className="font-mono text-base font-bold text-teal-700 break-all">{success.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-600 mb-0.5">Password</p>
                <p className="font-mono text-lg font-bold text-teal-700">{success.password}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              They can change their password from the Profile page after signing in.
            </p>
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
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* Profile form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="mt-1 text-xs text-gray-400">Changing this affects the student&rsquo;s display ID only — login uses email.</p>
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

              {/* Reset password (for activated students only) */}
              {!isLegacy && (
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetPassword}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setResetPassword(checked);
                        if (checked && !newPassword) setNewPassword(generatePassword());
                        if (!checked) { setNewPassword(''); setPwdError(''); }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Reset this student&rsquo;s password</span>
                  </label>
                  {resetPassword && (
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          id="es-pw"
                          type="text"
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); if (pwdError) setPwdError(''); }}
                          className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                            pwdError
                              ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                              : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
                          }`}
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => { setNewPassword(generatePassword()); if (pwdError) setPwdError(''); }}
                          className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-gray-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          title="Regenerate"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Regenerate
                        </button>
                      </div>
                      {pwdError && <p className="mt-1 text-xs text-red-600">{pwdError}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Save actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading || activating}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || activating}
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

            {/* Activate sign-in (for legacy students) */}
            {isLegacy && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3 mt-2">
                <div>
                  <p className="text-sm font-semibold text-yellow-800">This student doesn&rsquo;t have a sign-in account yet.</p>
                  <p className="mt-1 text-xs text-yellow-700">
                    Set them up with an email and temporary password to enable login. Their existing student ID, shifts, and history will all stay attached.
                  </p>
                </div>

                <div>
                  <label htmlFor="act-email" className="mb-1 block text-sm font-medium text-yellow-800">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="act-email"
                    type="email"
                    value={activateEmail}
                    onChange={(e) => {
                      setActivateEmail(e.target.value);
                      if (activateErrors.email) setActivateErrors((p) => ({ ...p, email: undefined }));
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      activateErrors.email
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                        : 'border-yellow-300 focus:border-teal-500 focus:ring-teal-500 bg-white'
                    }`}
                    placeholder="student@example.com"
                  />
                  {activateErrors.email && <p className="mt-1 text-xs text-red-600">{activateErrors.email}</p>}
                </div>

                <div>
                  <label htmlFor="act-pw" className="mb-1 block text-sm font-medium text-yellow-800">
                    Temporary password <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="act-pw"
                      type="text"
                      value={activatePassword}
                      onChange={(e) => {
                        setActivatePassword(e.target.value);
                        if (activateErrors.password) setActivateErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 bg-white ${
                        activateErrors.password
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                          : 'border-yellow-300 focus:border-teal-500 focus:ring-teal-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => { setActivatePassword(generatePassword()); if (activateErrors.password) setActivateErrors((p) => ({ ...p, password: undefined })); }}
                      className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-yellow-700 hover:text-teal-600 hover:bg-white transition-colors"
                      title="Regenerate"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
                  </div>
                  {activateErrors.password && <p className="mt-1 text-xs text-red-600">{activateErrors.password}</p>}
                </div>

                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating || loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors disabled:bg-teal-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
                >
                  {activating && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {activating ? 'Activating…' : 'Activate sign-in'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
