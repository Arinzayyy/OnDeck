'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<'student' | 'admin'>('student');

  // Student form
  const [studentId, setStudentId] = useState('');
  const [pin, setPin] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);

  // Admin form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  async function handleStudentLogin(e: React.FormEvent) {
    e.preventDefault();
    setStudentLoading(true);
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Login failed', 'error');
      } else {
        router.push('/student');
        router.refresh();
      }
    } finally {
      setStudentLoading(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminLoading(true);
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Login failed', 'error');
      } else {
        router.push('/admin');
        router.refresh();
      }
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-white px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-teal-600">OnDeck</h1>
        <p className="mt-2 text-gray-500">Clinic Scheduling Platform</p>
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Tab switcher */}
        <div className="grid grid-cols-2">
          {(['student', 'admin'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? 'border-b-2 border-teal-500 text-teal-600'
                  : 'border-b border-gray-200 text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'student' ? 'Student Login' : 'Admin Login'}
            </button>
          ))}
        </div>

        <div className="px-8 py-8">
          {tab === 'student' ? (
            <form onSubmit={handleStudentLogin} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Student ID
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                  placeholder="e.g. S001"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  4-Digit PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.slice(0, 4))}
                  placeholder="••••"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  inputMode="numeric"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={studentLoading}>
                Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ondeck.dev"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={adminLoading}>
                Sign In as Admin
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
