'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

interface ProfileFormProps {
  id: string;
  name: string;
  studentId: string;
  program: string | null;
  cohort: string | null;
  hasAuth: boolean;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const idx = full.indexOf(' ');
  if (idx === -1) return { firstName: full, lastName: '' };
  return { firstName: full.slice(0, idx), lastName: full.slice(idx + 1) };
}

interface DetailsErrors {
  firstName?: string;
  lastName?: string;
  general?: string;
}

interface PwdErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function ProfileForm({ name, studentId, program, cohort, hasAuth }: ProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ── Section A: Details ─────────────────────────────────────────────────────
  const { firstName: initFirst, lastName: initLast } = splitName(name);
  const [firstName, setFirstName] = useState(initFirst);
  const [lastName, setLastName] = useState(initLast);
  const [programVal, setProgramVal] = useState(program ?? '');
  const [cohortVal, setCohortVal] = useState(cohort ?? '');
  const [detailsErrors, setDetailsErrors] = useState<DetailsErrors>({});
  const [detailsLoading, setDetailsLoading] = useState(false);

  async function handleDetailsSave(e: React.FormEvent) {
    e.preventDefault();
    setDetailsErrors({});
    setDetailsLoading(true);

    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, program: programVal, cohort: cohortVal }),
      });

      const data = await res.json();

      if (res.ok) {
        toast('Profile updated.', 'success');
        router.refresh();
        return;
      }

      if (res.status === 400) {
        const field = data.field as keyof DetailsErrors | undefined;
        if (field && field !== 'general') {
          setDetailsErrors({ [field]: data.error });
        } else {
          setDetailsErrors({ general: data.error });
        }
        return;
      }

      setDetailsErrors({ general: data.error ?? 'Save failed. Please try again.' });
    } catch {
      setDetailsErrors({ general: 'Save failed. Please try again.' });
    } finally {
      setDetailsLoading(false);
    }
  }

  // ── Section B: Change password ─────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<PwdErrors>({});
  const [pwdLoading, setPwdLoading] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdErrors({});

    if (newPassword.length < 8) {
      setPwdErrors({ newPassword: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }
    if (newPassword === currentPassword) {
      setPwdErrors({ newPassword: 'New password must be different from the current password.' });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch('/api/student/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        toast('Password updated. Use your new password the next time you sign in.', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        return;
      }

      if (res.status === 401 || res.status === 400) {
        const field = data.field as keyof PwdErrors | undefined;
        if (field) {
          setPwdErrors({ [field]: data.error });
        } else {
          setPwdErrors({ currentPassword: data.error });
        }
        return;
      }

      setPwdErrors({ currentPassword: data.error ?? 'Password change failed. Please try again.' });
    } catch {
      setPwdErrors({ currentPassword: 'Password change failed. Please try again.' });
    } finally {
      setPwdLoading(false);
    }
  }

  const inputBase = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1';
  const inputNormal = 'border-gray-300 focus:border-teal-500 focus:ring-teal-500';
  const inputError = 'border-red-400 focus:border-red-400 focus:ring-red-400';

  function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Section A: Your details ────────────────────────────────────────── */}
      <form
        onSubmit={handleDetailsSave}
        className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5"
      >
        <h2 className="text-base font-semibold text-gray-900">Your details</h2>

        {detailsErrors.general && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {detailsErrors.general}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pf-first" className="mb-1 block text-sm font-medium text-gray-700">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="pf-first"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (detailsErrors.firstName) setDetailsErrors((p) => ({ ...p, firstName: undefined }));
              }}
              required
              className={`${inputBase} ${detailsErrors.firstName ? inputError : inputNormal}`}
            />
            {detailsErrors.firstName && (
              <p className="mt-1 text-xs text-red-600">{detailsErrors.firstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="pf-last" className="mb-1 block text-sm font-medium text-gray-700">
              Last name
            </label>
            <input
              id="pf-last"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (detailsErrors.lastName) setDetailsErrors((p) => ({ ...p, lastName: undefined }));
              }}
              placeholder="Add your last name when you're ready"
              className={`${inputBase} ${detailsErrors.lastName ? inputError : inputNormal}`}
            />
            {detailsErrors.lastName && (
              <p className="mt-1 text-xs text-red-600">{detailsErrors.lastName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pf-program" className="mb-1 block text-sm font-medium text-gray-700">
              Program
            </label>
            <input
              id="pf-program"
              type="text"
              value={programVal}
              onChange={(e) => setProgramVal(e.target.value)}
              className={`${inputBase} ${inputNormal}`}
            />
          </div>
          <div>
            <label htmlFor="pf-cohort" className="mb-1 block text-sm font-medium text-gray-700">
              Cohort
            </label>
            <input
              id="pf-cohort"
              type="text"
              value={cohortVal}
              onChange={(e) => setCohortVal(e.target.value)}
              className={`${inputBase} ${inputNormal}`}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Student ID</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-600">
            {studentId}
          </div>
          <p className="mt-1 text-xs text-gray-400">Need to change this? Ask your admin.</p>
        </div>

        <button
          type="submit"
          disabled={detailsLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors disabled:bg-teal-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
        >
          {detailsLoading && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {detailsLoading ? 'Saving…' : 'Save details'}
        </button>
      </form>

      {/* ── Section B: Change password ─────────────────────────────────────── */}
      {hasAuth && (
        <form
          onSubmit={handlePasswordChange}
          className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5"
        >
          <h2 className="text-base font-semibold text-gray-900">Change password</h2>

          {/* Current password */}
          <div>
            <label htmlFor="pf-cur-pw" className="mb-1 block text-sm font-medium text-gray-700">
              Current password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="pf-cur-pw"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (pwdErrors.currentPassword) setPwdErrors((p) => ({ ...p, currentPassword: undefined }));
                }}
                required
                className={`${inputBase} pr-10 ${pwdErrors.currentPassword ? inputError : inputNormal}`}
                placeholder="••••••••"
              />
              <EyeToggle show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
            </div>
            {pwdErrors.currentPassword && (
              <p className="mt-1 text-xs text-red-600">{pwdErrors.currentPassword}</p>
            )}
          </div>

          {/* New password */}
          <div>
            <label htmlFor="pf-new-pw" className="mb-1 block text-sm font-medium text-gray-700">
              New password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="pf-new-pw"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (pwdErrors.newPassword) setPwdErrors((p) => ({ ...p, newPassword: undefined }));
                }}
                required
                className={`${inputBase} pr-10 ${pwdErrors.newPassword ? inputError : inputNormal}`}
                placeholder="••••••••"
              />
              <EyeToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />
            </div>
            {pwdErrors.newPassword ? (
              <p className="mt-1 text-xs text-red-600">{pwdErrors.newPassword}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">8+ characters, mix letters and numbers.</p>
            )}
          </div>

          {/* Confirm new password */}
          <div>
            <label htmlFor="pf-conf-pw" className="mb-1 block text-sm font-medium text-gray-700">
              Confirm new password <span className="text-red-500">*</span>
            </label>
            <input
              id="pf-conf-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (pwdErrors.confirmPassword) setPwdErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
              required
              className={`${inputBase} ${pwdErrors.confirmPassword ? inputError : inputNormal}`}
              placeholder="••••••••"
            />
            {pwdErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{pwdErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={pwdLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors disabled:bg-teal-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
          >
            {pwdLoading && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {pwdLoading ? 'Updating…' : 'Change password'}
          </button>
        </form>
      )}
    </div>
  );
}
