import { createServerClient } from './supabase/server';

/**
 * Capacity enforcement for shift bookings.
 *
 * Two rules are checked together:
 *   1. max_per_day   — a student cannot have more than N approved/pending shifts
 *                      on the same calendar day.
 *   2. max_concurrent — at most N shifts may overlap the same clock hour across
 *                       ALL students (prevents clinic overcrowding).
 *
 * Both limits come from the `settings` table so admins can tune them live.
 *
 * The `excludeShiftId` param lets edit/reassign flows re-check without counting
 * the shift being replaced (so "update shift A" doesn't trip over shift A itself).
 *
 * When `overrideCap` is true the function always returns { allowed: true } —
 * intended for admin-only operations that explicitly bypass limits.
 */

export interface CapacityCheckInput {
  studentId: string;
  date: string;         // "YYYY-MM-DD"
  startTime: string;    // "HH:MM"
  endTime: string;      // "HH:MM"
  excludeShiftId?: string;
  overrideCap?: boolean;
}

export interface CapacityCheckResult {
  allowed: boolean;
  reason?: 'max_per_day' | 'max_concurrent';
  limit?: number;
  current?: number;
}

export async function checkCapacity(
  input: CapacityCheckInput
): Promise<CapacityCheckResult> {
  const { studentId, date, startTime, endTime, excludeShiftId, overrideCap } =
    input;

  if (overrideCap) return { allowed: true };

  const db = createServerClient();

  // Load settings (single row, always exists due to seed)
  const { data: settings, error: settingsErr } = await db
    .from('settings')
    .select('max_per_day, max_concurrent')
    .single();

  if (settingsErr || !settings) {
    throw new Error('Failed to load settings: ' + settingsErr?.message);
  }

  const { max_per_day, max_concurrent } = settings;

  // ── 1. max_per_day check ──────────────────────────────────────────────────
  // Count active (pending or approved) shifts for this student on this date,
  // excluding the shift being edited (if any).
  let perDayQuery = db
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('date', date)
    .in('status', ['pending', 'approved']);

  if (excludeShiftId) {
    perDayQuery = perDayQuery.neq('id', excludeShiftId);
  }

  const { count: perDayCount, error: perDayErr } = await perDayQuery;

  if (perDayErr) throw new Error('Capacity check failed: ' + perDayErr.message);

  if ((perDayCount ?? 0) >= max_per_day) {
    return {
      allowed: false,
      reason: 'max_per_day',
      limit: max_per_day,
      current: perDayCount ?? 0,
    };
  }

  // ── 2. max_concurrent check ───────────────────────────────────────────────
  // Find all active shifts on this date across ALL students whose time window
  // overlaps the requested window: overlap occurs when
  //   existing.start_time < new.end_time AND existing.end_time > new.start_time
  //
  // We can't do time arithmetic natively in this query without casting to
  // interval, so we fetch candidate rows and filter in JS. Shifts on a single
  // day are few (< hundreds), so this is fine.
  let overlapQuery = db
    .from('shifts')
    .select('id, start_time, end_time')
    .eq('date', date)
    .in('status', ['pending', 'approved']);

  if (excludeShiftId) {
    overlapQuery = overlapQuery.neq('id', excludeShiftId);
  }

  const { data: dayShifts, error: overlapErr } = await overlapQuery;

  if (overlapErr)
    throw new Error('Concurrent capacity check failed: ' + overlapErr.message);

  // Count shifts that overlap ANY hour-long bucket that our new shift covers.
  // We measure overlap using interval intersection:
  //   A overlaps B iff A.start < B.end AND A.end > B.start
  const overlapping = (dayShifts ?? []).filter((s) => {
    return s.start_time < endTime && s.end_time > startTime;
  });

  if (overlapping.length >= max_concurrent) {
    return {
      allowed: false,
      reason: 'max_concurrent',
      limit: max_concurrent,
      current: overlapping.length,
    };
  }

  return { allowed: true };
}
