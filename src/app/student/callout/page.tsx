/**
 * Student callout page — select an approved shift and submit a callout reason.
 * Optionally upload a supporting photo (doctor's note, etc.).
 */
import { getStudentFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/server';
import { CalloutForm } from './CalloutForm';
import type { Shift } from '@/lib/types';

export default async function StudentCalloutPage() {
  const student = await getStudentFromCookies();
  if (!student) return null;

  const db = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  // Only future/today approved shifts that don't already have a callout
  const { data: approvedShifts } = await db
    .from('shifts')
    .select('*')
    .eq('student_id', student.sub)
    .eq('status', 'approved')
    .gte('date', today)
    .order('date')
    .order('start_time');

  // Get shift IDs that already have callouts
  const shiftIds = (approvedShifts ?? []).map((s) => s.id);
  const { data: existingCallouts } = shiftIds.length
    ? await db.from('callouts').select('shift_id').in('shift_id', shiftIds)
    : { data: [] };

  const calledOutIds = new Set((existingCallouts ?? []).map((c) => c.shift_id));
  const eligible = ((approvedShifts ?? []) as Shift[]).filter(
    (s) => !calledOutIds.has(s.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Out</h1>
        <p className="mt-1 text-sm text-gray-500">
          Submit a callout for an upcoming approved shift.
        </p>
      </div>

      <div className="max-w-xl">
        <CalloutForm eligibleShifts={eligible} />
      </div>
    </div>
  );
}
