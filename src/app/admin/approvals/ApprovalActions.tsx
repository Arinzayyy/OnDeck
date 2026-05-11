'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function ApprovalActions({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  async function handle(action: 'approve' | 'reject') {
    setLoading(action);
    try {
      const res = await fetch(`/api/approvals/${shiftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Action failed', 'error');
      } else {
        toast(action === 'approve' ? 'Shift approved.' : 'Shift rejected.', 'success');
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="danger"
        size="sm"
        onClick={() => handle('reject')}
        loading={loading === 'reject'}
        disabled={loading !== null}
      >
        Reject
      </Button>
      <Button
        size="sm"
        onClick={() => handle('approve')}
        loading={loading === 'approve'}
        disabled={loading !== null}
      >
        Approve
      </Button>
    </div>
  );
}
