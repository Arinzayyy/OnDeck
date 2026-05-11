'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { AddAdminModal } from '@/components/AddAdminModal';
import type { Admin } from '@/lib/types';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) === 1 ? '' : 's'} ago`;
}

export function AdminUsersSection() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/admins');
      if (!res.ok) return;
      const data = await res.json();
      setAdmins(data.admins ?? []);
      setCurrentAdminId(data.currentAdminId ?? '');
    } catch {
      // silently fail — user sees empty table
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  async function handleRemove(admin: Admin) {
    const confirmed = window.confirm(
      `Remove ${admin.email} as an admin? They will lose access immediately.`
    );
    if (!confirmed) return;

    setRemovingId(admin.id);
    try {
      const res = await fetch(`/api/admins/${admin.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
        toast(`Removed ${admin.email} from admins.`, 'success');
      } else {
        toast(data.error ?? 'Failed to remove admin.', 'error');
      }
    } catch {
      toast('Failed to remove admin.', 'error');
    } finally {
      setRemovingId(null);
    }
  }

  function handleAdded(newAdmin: Admin) {
    setAdmins((prev) => [...prev, newAdmin]);
  }

  const isSoleAdmin = admins.length <= 1;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Admin users</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Admins can manage shifts, students, callouts, and settings.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-600 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add admin
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
      ) : admins.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No admins found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Added
                </th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((admin) => {
                const isSelf = admin.id === currentAdminId;
                const isRemoving = removingId === admin.id;
                const disabled = isSelf || isSoleAdmin || isRemoving;
                const tooltip = isSelf
                  ? "You can't remove yourself"
                  : isSoleAdmin
                  ? "Can't remove the last admin"
                  : undefined;

                return (
                  <tr key={admin.id} className="group">
                    <td className="py-3 text-gray-900">
                      {admin.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400">(you)</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500">{timeAgo(admin.created_at)}</td>
                    <td className="py-3 text-right">
                      <span title={tooltip} className="inline-block">
                        <button
                          onClick={() => handleRemove(admin)}
                          disabled={disabled}
                          className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isRemoving ? 'Removing…' : 'Remove'}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddAdminModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
