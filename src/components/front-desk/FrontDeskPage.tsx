'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Field schema ──────────────────────────────────────────────────────────────

const FIELD_DEFS = [
  { key: 'name' as const, label: 'Full name' },
  { key: 'email' as const, label: 'Email' },
  { key: 'address' as const, label: 'Home address' },
  { key: 'phone' as const, label: 'Phone number' },
  { key: 'preferred_pharmacy' as const, label: 'Preferred pharmacy' },
];

type FieldKey = 'name' | 'email' | 'address' | 'phone' | 'preferred_pharmacy';
type Fields = Record<FieldKey, boolean>;

const ALL_KEYS = FIELD_DEFS.map((f) => f.key);

const DEFAULT_FIELDS: Fields = {
  name: true,
  email: true,
  address: true,
  phone: true,
  preferred_pharmacy: true,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveForm {
  id: string;
  token: string;
  fields: Fields;
}

interface SubmissionRow {
  id: string;
  form_id: string;
  submission: Record<string, string>;
  submitted_at: string;
  expires_at: string;
  fields: Fields;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const totalMins = Math.round(diff / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `clears in ${h}h ${m}m`;
  return `clears in ${m}m`;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function absoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

// ─── Clipboard SVG icon ────────────────────────────────────────────────────────

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── Intake Link Tab ───────────────────────────────────────────────────────────

function IntakeLinkTab() {
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [toggles, setToggles] = useState<Fields>({ ...DEFAULT_FIELDS });
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch('/api/intakes/forms')
      .then((r) => r.json())
      .then((data) => {
        const form = data.forms?.[0] ?? null;
        setActiveForm(form);
        if (!form) setEditMode(true);
        if (form) setToggles({ ...DEFAULT_FIELDS, ...form.fields });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaveError('');
    if (!ALL_KEYS.some((k) => toggles[k])) {
      setSaveError('Select at least one field.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/intakes/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toggles }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return; }
      setActiveForm({ id: data.id, token: data.token, fields: data.fields });
      setEditMode(false);
    } catch {
      setSaveError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    if (!activeForm) return;
    const url = `${getAppUrl()}/intake/${activeForm.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1200);
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const intakeUrl = activeForm ? `${getAppUrl()}/intake/${activeForm.token}` : '';
  const enabledLabels = activeForm
    ? FIELD_DEFS.filter((f) => activeForm.fields[f.key]).map((f) => f.label)
    : [];

  // Toggle / edit panel
  if (!activeForm || editMode) {
    return (
      <div className="max-w-xl space-y-5">
        {editMode && activeForm && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Saving a new set of fields will replace the current link. Anyone holding the old link will see a &ldquo;no longer active&rdquo; message.
          </div>
        )}

        <div>
          <h2 className="text-base font-semibold text-gray-900">
            What information do you need from each patient?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Toggle off anything you don&rsquo;t need. Each patient will only see the fields you&rsquo;ve enabled.
          </p>
        </div>

        <div className="space-y-3">
          {FIELD_DEFS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={toggles[key]}
                onChange={(e) => setToggles((t) => ({ ...t, [key]: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 accent-teal-600"
              />
              <span className="text-sm text-gray-800">{label}</span>
            </label>
          ))}
        </div>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !ALL_KEYS.some((k) => toggles[k])}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors disabled:bg-teal-300 disabled:cursor-not-allowed"
          >
            {saving && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Saving…' : 'Save & generate link'}
          </button>
          {editMode && activeForm && (
            <button
              onClick={() => { setEditMode(false); setToggles({ ...DEFAULT_FIELDS, ...activeForm.fields }); setSaveError(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Link view
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Your patient intake link</h2>
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-medium">Patients fill in:</span>{' '}
          {enabledLabels.join(' · ')}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm break-all text-gray-800">
        {intakeUrl}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCopyLink}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            linkCopied
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-teal-500 text-white hover:bg-teal-600'
          }`}
        >
          {linkCopied ? (
            <><CheckIcon className="h-4 w-4" /> Copied</>
          ) : (
            'Copy link'
          )}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Share this link with patients however works best — text it to them, type it into their phone, or write it on a card.
        Each open loads a fresh blank form, so the same link works for every patient.
      </p>

      <button
        onClick={() => { setEditMode(true); setToggles({ ...DEFAULT_FIELDS, ...activeForm.fields }); setSaveError(''); }}
        className="text-sm font-medium text-teal-600 hover:text-teal-800 transition-colors underline underline-offset-2"
      >
        Change which fields are collected
      </button>
    </div>
  );
}

// ─── Submissions Tab ───────────────────────────────────────────────────────────

function SubmissionsTab() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // incremented every minute to refresh countdowns
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/intakes/submissions');
      const data = await res.json();
      if (res.ok) setSubmissions(data.submissions ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    loadSubmissions().finally(() => setLoading(false));

    // Auto-poll every 15s
    intervalRef.current = setInterval(loadSubmissions, 15000);

    // Refresh countdowns every 60s
    const tickInterval = setInterval(() => setTick((t) => t + 1), 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(tickInterval);
    };
  }, [loadSubmissions]);

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch {}
  }

  async function handleClear(id: string) {
    setClearingId(id);
    try {
      await fetch(`/api/intakes/submissions/${id}`, { method: 'DELETE' });
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setConfirmClearId(null);
      if (expandedId === id) setExpandedId(null);
    } catch {
    } finally {
      setClearingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        <p>No submissions yet.</p>
        <p className="mt-1">Share the intake link with patients from the Intake link tab — their submissions will show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={() => loadSubmissions()}
          className="text-xs text-gray-400 hover:text-teal-600 transition-colors flex items-center gap-1"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {submissions.map((s) => {
        const enabledFields = FIELD_DEFS.filter((f) => s.fields[f.key] && s.submission[f.key]);
        const patientName = s.submission['name'] || null;
        const fieldSummary = enabledFields.map((f) => f.label).join(' · ');
        const isExpanded = expandedId === s.id;

        return (
          <div key={s.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Collapsed row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : s.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">
                    {patientName ?? <span className="text-gray-400 italic">(no name collected)</span>}
                  </span>
                  <span className="text-xs text-gray-400">{fieldSummary}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                  <span title={absoluteTime(s.submitted_at)}>{relativeTime(s.submitted_at)}</span>
                </div>
              </div>

              {/* Countdown pill */}
              <span className="flex-shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 whitespace-nowrap">
                {/* tick used to force re-render for countdown */}
                {tick >= 0 && formatCountdown(s.expires_at)}
              </span>

              {/* Inline clear (collapsed) */}
              <div
                className="flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {confirmClearId === s.id ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="text-gray-500">Clear?</span>
                    <button
                      onClick={() => handleClear(s.id)}
                      disabled={clearingId === s.id}
                      className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmClearId(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmClearId(s.id)}
                    className="rounded p-1 text-gray-300 hover:text-red-400 transition-colors"
                    title="Clear submission"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Chevron */}
              <svg
                className={`h-4 w-4 text-gray-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                {enabledFields.map(({ key, label }) => {
                  const value = s.submission[key] ?? '';
                  const ck = `${s.id}__${key}`;
                  const wasCopied = copiedKey === ck;
                  return (
                    <div key={key}>
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">{label}</p>
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-base font-medium text-gray-900 font-mono break-all">{value}</p>
                        <button
                          onClick={() => copyValue(ck, value)}
                          title="Copy"
                          className={`flex-shrink-0 flex items-center gap-1 rounded p-1 text-xs transition-colors ${
                            wasCopied ? 'text-green-600' : 'text-gray-400 hover:text-teal-600'
                          }`}
                        >
                          {wasCopied ? (
                            <><CheckIcon className="h-4 w-4" /><span>Copied</span></>
                          ) : (
                            <ClipboardIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Copy all + Clear */}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => {
                      const allText = enabledFields
                        .map(({ key, label }) => `${label}: ${s.submission[key] ?? ''}`)
                        .join('\n');
                      const ck = `${s.id}__all`;
                      copyValue(ck, allText);
                    }}
                    className={`text-sm font-medium transition-colors ${
                      copiedKey === `${s.id}__all` ? 'text-green-600' : 'text-gray-600 hover:text-teal-600'
                    }`}
                  >
                    {copiedKey === `${s.id}__all` ? 'Copied all!' : 'Copy all'}
                  </button>

                  <span className="flex-1" />

                  {confirmClearId === s.id ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Are you sure?</span>
                      <button
                        onClick={() => handleClear(s.id)}
                        disabled={clearingId === s.id}
                        className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmClearId(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmClearId(s.id)}
                      className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main FrontDeskPage ────────────────────────────────────────────────────────

export function FrontDeskPage() {
  const [tab, setTab] = useState<'link' | 'submissions'>('link');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Front Desk</h1>
        <p className="mt-1 text-sm text-gray-500">Patient intake and submissions management.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {(['link', 'submissions'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t === 'link' ? 'Intake link' : 'Submissions'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'link' ? <IntakeLinkTab /> : <SubmissionsTab />}
      </div>
    </div>
  );
}
