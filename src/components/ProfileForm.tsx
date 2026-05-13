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

interface PinErrors {
  currentPin?: string;
  newPin?: string;
  confirmPin?: string;
}

export function ProfileForm({ name, studentId, program, cohort }: ProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ── Section A: Details ────────────────────────────────────────────────────
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
        body: JSON.stringify({
          firstName,
          lastName,
          program: programVal,
          cohort: cohortVal,
        }),
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

  // ── Section B: Change PIN ─────────────────────────────────────────────────
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinErrors, setPinErrors] = useState<PinErrors>({});
  const [pinLoading, setPinLoading] = useState(false);

  function onlyDigits(v: string) {
    return v.replace(/\D/g, '').slice(0, 4);
  }

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    setPinErrors({});

    if (newPin !== confirmPin) {
      setPinErrors({ confirmPin: 'PINs do not match.' });
      return;
    }
    if (newPin === currentPin) {
      setPinErrors({ newPin: 'New PIN must be different from the current PIN.' });
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch('/api/student/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      });

      const data = await res.json();

      if (res.ok) {
        toast('PIN updated. Use your new PIN the next time you sign in.', 'success');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        return;
      }

      if (res.status === 401 || res.status === 400) {
        const field = data.field as keyof PinErrors | undefined;
        if (field) {
          setPinErrors({ [field]: data.error });
        } else {
          setPinErrors({ currentPin: data.error });
        }
        return;
      }

      setPinErrors({ currentPin: data.error ?? 'PIN change failed. Please try again.' });
    } catch {
      setPinErrors({ currentPin: 'PIN change failed. Please try again.' });
    } finally {
      setPinLoading(false);
    }
  }

  const inputBase = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1';
  const inputNormal = 'border-gray-300 focus:border-teal-500 focus:ring-teal-500';
  const inputError = 'border-red-400 focus:border-red-400 focus:ring-red-400';

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

        {/* First + Last name */}
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

        {/* Program + Cohort */}
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

        {/* Student ID — read-only */}
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

      {/* ── Section B: Change PIN ──────────────────────────────────────────── */}
      <form
        onSubmit={handlePinChange}
        className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5"
      >
        <h2 className="text-base font-semibold text-gray-900">Change PIN</h2>

        {/* Current PIN */}
        <div>
          <label htmlFor="pf-cur-pin" className="mb-1 block text-sm font-medium text-gray-700">
            Current PIN <span className="text-red-500">*</span>
          </label>
          <input
            id="pf-cur-pin"
            type="password"
            value={currentPin}
            onChange={(e) => {
              setCurrentPin(onlyDigits(e.target.value));
              if (pinErrors.currentPin) setPinErrors((p) => ({ ...p, currentPin: undefined }));
            }}
            inputMode="numeric"
            maxLength={4}
            required
            className={`${inputBase} font-mono ${pinErrors.currentPin ? inputError : inputNormal}`}
            placeholder="••••"
          />
          {pinErrors.currentPin && (
            <p className="mt-1 text-xs text-red-600">{pinErrors.currentPin}</p>
          )}
        </div>

        {/* New PIN */}
        <div>
          <label htmlFor="pf-new-pin" className="mb-1 block text-sm font-medium text-gray-700">
            New PIN <span className="text-red-500">*</span>
          </label>
          <input
            id="pf-new-pin"
            type="password"
            value={newPin}
            onChange={(e) => {
              setNewPin(onlyDigits(e.target.value));
              if (pinErrors.newPin) setPinErrors((p) => ({ ...p, newPin: undefined }));
            }}
            inputMode="numeric"
            maxLength={4}
            required
            className={`${inputBase} font-mono ${pinErrors.newPin ? inputError : inputNormal}`}
            placeholder="••••"
          />
          {pinErrors.newPin && (
            <p className="mt-1 text-xs text-red-600">{pinErrors.newPin}</p>
          )}
        </div>

        {/* Confirm new PIN */}
        <div>
          <label htmlFor="pf-conf-pin" className="mb-1 block text-sm font-medium text-gray-700">
            Confirm new PIN <span className="text-red-500">*</span>
          </label>
          <input
            id="pf-conf-pin"
            type="password"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(onlyDigits(e.target.value));
              if (pinErrors.confirmPin) setPinErrors((p) => ({ ...p, confirmPin: undefined }));
            }}
            inputMode="numeric"
            maxLength={4}
            required
            className={`${inputBase} font-mono ${pinErrors.confirmPin ? inputError : inputNormal}`}
            placeholder="••••"
          />
          {pinErrors.confirmPin && (
            <p className="mt-1 text-xs text-red-600">{pinErrors.confirmPin}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pinLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors disabled:bg-teal-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
        >
          {pinLoading && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {pinLoading ? 'Updating…' : 'Change PIN'}
        </button>
      </form>
    </div>
  );
}
