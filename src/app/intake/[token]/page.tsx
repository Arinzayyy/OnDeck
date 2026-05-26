'use client';

import { useState, useEffect } from 'react';

const FIELD_DEFS = [
  { key: 'name' as const, label: 'Full name', inputType: 'text' },
  { key: 'email' as const, label: 'Email', inputType: 'email' },
  { key: 'address' as const, label: 'Home address', inputType: 'textarea' },
  { key: 'phone' as const, label: 'Phone number', inputType: 'tel' },
  { key: 'preferred_pharmacy' as const, label: 'Preferred pharmacy', inputType: 'text' },
] as const;

type FieldKey = 'name' | 'email' | 'address' | 'phone' | 'preferred_pharmacy';
type Fields = Record<FieldKey, boolean>;

type PageState = 'loading' | 'inactive' | 'active' | 'submitted';

interface IntakePageProps {
  params: { token: string };
}

export default function IntakePage({ params }: IntakePageProps) {
  const { token } = params;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [fields, setFields] = useState<Fields>({
    name: false, email: false, address: false, phone: false, preferred_pharmacy: false,
  });
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/intakes/public/${token}`)
      .then(async (res) => {
        if (res.status === 410 || !res.ok) { setPageState('inactive'); return; }
        const data = await res.json();
        setFields(data.fields ?? {});
        setPageState('active');
      })
      .catch(() => setPageState('inactive'));
  }, [token]);

  const activeFields = FIELD_DEFS.filter((f) => fields[f.key]);

  function setValue(key: FieldKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<FieldKey, string>> = {};
    for (const { key, label, inputType } of activeFields) {
      const val = (values[key] ?? '').trim();
      if (!val) { errs[key] = `${label} is required.`; continue; }
      if (inputType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errs[key] = 'Please enter a valid email address.';
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    const body: Record<string, string> = {};
    for (const { key } of activeFields) {
      body[key] = (values[key] ?? '').trim();
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/intakes/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 410) { setPageState('inactive'); return; }
      if (!res.ok) {
        const data = await res.json();
        if (data.field) {
          setFieldErrors({ [data.field]: data.error });
        } else {
          setSubmitError(data.error ?? 'Something went wrong. Please try again.');
        }
        return;
      }

      setPageState('submitted');
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartNew() {
    setValues({});
    setFieldErrors({});
    setSubmitError('');
    setPageState('active');
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-[420px] rounded-2xl bg-white shadow-md px-6 py-8">

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        )}

        {/* Inactive */}
        {pageState === 'inactive' && (
          <div className="text-center py-4 space-y-2">
            <p className="text-gray-600 text-sm">
              This form is no longer active. Please ask the front desk for an updated link.
            </p>
          </div>
        )}

        {/* Thank-you */}
        {pageState === 'submitted' && (
          <div className="text-center py-4 space-y-4">
            <div className="flex justify-center">
              <span className="text-4xl">✓</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Thank you!</h2>
            <p className="text-sm text-gray-500">
              Your information has been received. You can hand the phone back to the front desk or close this page.
            </p>
            <button
              onClick={handleStartNew}
              className="mt-2 text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2 transition-colors"
            >
              Start a new form
            </button>
          </div>
        )}

        {/* Active form */}
        {pageState === 'active' && (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Welcome to Tri-Valley Urgent Care</h2>
              <p className="mt-1 text-sm text-gray-500">
                Please fill in your details below. This information helps us serve you better.
              </p>
            </div>

            {activeFields.map(({ key, label, inputType }) => {
              const error = fieldErrors[key];
              const baseClass = `w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                error
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
              }`;
              return (
                <div key={key}>
                  <label htmlFor={`field-${key}`} className="mb-1.5 block text-sm font-medium text-gray-700">
                    {label} <span className="text-red-500">*</span>
                  </label>
                  {inputType === 'textarea' ? (
                    <textarea
                      id={`field-${key}`}
                      rows={2}
                      value={values[key] ?? ''}
                      onChange={(e) => setValue(key, e.target.value)}
                      required
                      className={baseClass}
                    />
                  ) : (
                    <input
                      id={`field-${key}`}
                      type={inputType}
                      value={values[key] ?? ''}
                      onChange={(e) => setValue(key, e.target.value)}
                      required
                      className={baseClass}
                    />
                  )}
                  {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                </div>
              );
            })}

            {submitError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 transition-colors disabled:bg-teal-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
