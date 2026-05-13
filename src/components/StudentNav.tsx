'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StudentJwtPayload } from '@/lib/types';

interface StudentNavProps {
  student: StudentJwtPayload;
}

const NAV_ITEMS = [
  { href: '/student', label: 'Home', exact: true },
  { href: '/student/week', label: 'My Week' },
  { href: '/student/history', label: 'History' },
  { href: '/student/callout', label: 'Call Out' },
  { href: '/student/profile', label: 'Profile' },
];

export function StudentNav({ student }: StudentNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <header className="border-b border-gray-100 bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <Link href="/student" className="text-lg font-bold text-teal-600">
          OnDeck
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, exact }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(href, exact)
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: name + logout */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-gray-600">
            {student.name}
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="flex sm:hidden border-t border-gray-100">
        {NAV_ITEMS.map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
              isActive(href, exact)
                ? 'text-teal-600 border-t-2 border-teal-500 -mt-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
