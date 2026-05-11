'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { StatusBadge } from './ui/StatusBadge';
import { useToast } from './ui/Toast';
import type { Shift } from '@/lib/types';

interface ShiftDetailModalProps {
  open: boolean;
  onClose: () => void;
  shift: Shift;
  /** true = show admin actions (approve/reject/edit), false = student view */
  isAdmin?: boolean;
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ShiftDetailModal({
  open,
  onClose,
  shift,
  isAdmin = false,
}: ShiftDetailModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null); // 'approve'|'reject'|'cancel'

  async function handleApproval(action: 'approve' | 'reject') {
    setLoading(action);
    try {
      const res = await fetch(`/api/approvals/${shift.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Action failed', 'error');
      } else {
        toast(action === 'approve' ? 'Shift approved.' : 'Shift rejected.', 'success');
        onClose();
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    setLoading('cancel');
    try {
      const res = await fetch(`/api/shifts/${shift.id}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Cancel failed', 'error');
      } else {
        toast('Shift cancelled.', 'success');
        onClose();
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Shift Details">
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <StatusBadge status={shift.status} />
          {shift.override_cap && (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
              Cap Override
            </span>
          )}
        </div>

        {/* Details grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Date</dt>
            <dd className="text-gray-900">{formatDate(shift.date)}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Time</dt>
            <dd className="text-gray-900">
              {shift.start_time} – {shift.end_time}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Clinic</dt>
            <dd className="text-gray-900">{shift.clinic}</dd>
          </div>
          {shift.student && (
            <div>
              <dt className="font-medium text-gray-500">Student</dt>
              <dd className="text-gray-900">
                {shift.student.name}{' '}
                <span className="text-gray-400">({shift.student.student_id})</span>
              </dd>
            </div>
          )}
          {shift.notes && (
            <div className="col-span-2">
              <dt className="font-medium text-gray-500">Notes</dt>
              <dd className="text-gray-900">{shift.notes}</dd>
            </div>
          )}
        </dl>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
          {/* Admin: approve/reject pending */}
          {isAdmin && shift.status === 'pending' && (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleApproval('reject')}
                loading={loading === 'reject'}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleApproval('approve')}
                loading={loading === 'approve'}
              >
                Approve
              </Button>
            </>
          )}

          {/* Student: cancel pending/approved */}
          {!isAdmin && ['pending', 'approved'].includes(shift.status) && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              loading={loading === 'cancel'}
            >
              Cancel Shift
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
