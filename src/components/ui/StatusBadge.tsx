import type { ShiftStatus } from '@/lib/types';

const classes: Record<ShiftStatus, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  cancelled: 'badge-cancelled',
  called_out: 'badge-called-out',
};

const labels: Record<ShiftStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  cancelled: 'Cancelled',
  called_out: 'Called Out',
};

export function StatusBadge({ status }: { status: ShiftStatus }) {
  return <span className={classes[status]}>{labels[status]}</span>;
}
