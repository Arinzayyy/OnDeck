'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/ui/Toast';
import type { Admin } from '@/lib/types';

interface AddAdminModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: (admin: Admin) => void;
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

function generatePassword(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => CHARS[b % CHARS.length])
    .join('');
}

export function AddAdminModal({ open, onClose, onAdded }: AddAdminModalProps) {
  const { toast } = useToast();
  const emailRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail('');
      setPassword('');
      setEmailError('');
      setPasswordError('');
      setTimeout(() => emailRef.current?.focus(), 0);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.status === 201) {
        onAdded(data.admin as Admin);
        toast(
          `Added ${email} as an admin. Share their password with them so they can sign in.`,
          'success'
        );
        handleClose();
        return;
      }

      if (res.status === 409 || res.status === 400) {
        if (data.field === 'password') {
          setPasswordError(data.error);
        } else {
          setEmailError(data.error);
        }
        return;
      }

      toast("Couldn't add admin. Please try again.", 'error');
    } catch {
      toast("Couldn't add admin. Please try again.", 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-admin-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="add-admin-title" className="text-lg font-semibold text-gray-900">
            Add admin
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
          {/* Email */}
          <div>
            <label htmlFor="aa-email" className="mb-1 block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="aa-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              required
              placeholder="newadmin@clinic.com"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                emailError
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
              }`}
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-600">{emailError}</p>
            )}
          </div>

          {/* Temporary password */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="aa-password" className="text-sm font-medium text-gray-700">
                Temporary password <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPassword(generatePassword());
                  if (passwordError) setPasswordError('');
                }}
                className="text-xs text-teal-600 hover:text-teal-700 hover:underline"
              >
                Generate
              </button>
            </div>
            <input
              id="aa-password"
              type="text"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              required
              minLength={8}
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                passwordError
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500'
              }`}
            />
            {passwordError ? (
              <p className="mt-1 text-xs text-red-600">{passwordError}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">minimum 8 characters</p>
            )}
          </div>

          {/* Helper */}
          <p className="text-xs text-gray-400">
            The new admin can sign in immediately at the login page using this email and password.
            They can then change their password in Supabase if needed.
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
              {loading ? 'Adding…' : 'Add admin'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
