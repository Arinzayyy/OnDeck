'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/approvals', label: 'Approvals' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/callouts', label: 'Callouts' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminNav() {
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
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-lg font-bold text-teal-600">
            OnDeck
          </Link>
          <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
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

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          {loggingOut ? '…' : 'Sign out'}
        </button>
      </div>

      {/* Mobile scroll nav */}
      <div className="md:hidden overflow-x-auto">
        <nav className="flex gap-1 px-4 pb-2">
          {NAV_ITEMS.map(({ href, label, exact }) => (
            <Link
              key={href}
              href={href}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(href, exact)
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
