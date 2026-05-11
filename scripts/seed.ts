/**
 * Seed script — populates the database with demo data.
 *
 * Run: npm run seed
 * (Requires .env.local with valid Supabase + admin credentials)
 *
 * Idempotent: running twice won't duplicate records.
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@ondeck.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme123';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Hash a PIN with SHA-256 (same as auth route) */
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

/** Returns a date string N days from today */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('🌱 Seeding OnDeck database...\n');

  // ── 1. Create admin user via Supabase Auth ──────────────────────────────────
  console.log(`👤 Creating admin: ${ADMIN_EMAIL}`);
  const { data: existingAdmin } = await db.auth.admin.listUsers();
  const adminExists = existingAdmin?.users.some((u) => u.email === ADMIN_EMAIL);

  let adminId: string;
  if (adminExists) {
    console.log('   Admin already exists, skipping.');
    adminId = existingAdmin!.users.find((u) => u.email === ADMIN_EMAIL)!.id;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error('   Failed to create admin:', error.message);
      process.exit(1);
    }
    adminId = data.user.id;
    console.log('   ✓ Admin user created:', adminId);
  }

  // Insert into admins table
  await db.from('admins').upsert({ id: adminId, email: ADMIN_EMAIL });
  console.log('   ✓ Admin row upserted\n');

  // ── 2. Seed students ─────────────────────────────────────────────────────────
  const students = [
    { name: 'Alice Mwangi', student_id: 'S001', program: 'Dental Hygiene Year 2', cohort: '2025', pin: '1234' },
    { name: 'Bruno Ferreira', student_id: 'S002', program: 'Dental Hygiene Year 1', cohort: '2026', pin: '2345' },
    { name: 'Chloe Okafor', student_id: 'S003', program: 'Dental Assisting Year 2', cohort: '2025', pin: '3456' },
    { name: 'David Kim', student_id: 'S004', program: 'Dental Assisting Year 1', cohort: '2026', pin: '4567' },
    { name: 'Emma Johansson', student_id: 'S005', program: 'Dental Hygiene Year 2', cohort: '2025', pin: '5678' },
  ];

  console.log('👥 Seeding students...');
  const studentIds: Record<string, string> = {};

  for (const s of students) {
    const { data: existing } = await db
      .from('students')
      .select('id')
      .eq('student_id', s.student_id)
      .single();

    if (existing) {
      studentIds[s.student_id] = existing.id;
      console.log(`   ~ ${s.name} (${s.student_id}) already exists`);
      continue;
    }

    const { data, error } = await db
      .from('students')
      .insert({
        name: s.name,
        student_id: s.student_id,
        program: s.program,
        cohort: s.cohort,
        pin_hash: hashPin(s.pin),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ✗ Failed to insert ${s.name}:`, error.message);
      continue;
    }

    studentIds[s.student_id] = data.id;
    console.log(`   ✓ ${s.name} (${s.student_id}) — PIN: ${s.pin}`);
  }

  // ── 3. Seed shifts ────────────────────────────────────────────────────────────
  console.log('\n📅 Seeding shifts...');

  const shifts = [
    // Alice — 3 upcoming
    { sid: 'S001', date: daysFromNow(1), start: '09:00', end: '12:00', clinic: 'Clinic A', status: 'approved' },
    { sid: 'S001', date: daysFromNow(3), start: '13:00', end: '16:00', clinic: 'Clinic B', status: 'pending' },
    { sid: 'S001', date: daysFromNow(7), start: '09:00', end: '12:00', clinic: 'Clinic A', status: 'pending' },
    // Bruno — mix
    { sid: 'S002', date: daysFromNow(2), start: '09:00', end: '12:00', clinic: 'Clinic B', status: 'approved' },
    { sid: 'S002', date: daysFromNow(5), start: '13:30', end: '17:00', clinic: 'Radiology', status: 'pending' },
    // Chloe — approved, past cancelled
    { sid: 'S003', date: daysFromNow(1), start: '13:00', end: '16:00', clinic: 'Ortho Suite', status: 'approved' },
    { sid: 'S003', date: daysFromNow(4), start: '09:00', end: '12:00', clinic: 'Clinic A', status: 'pending' },
    // David
    { sid: 'S004', date: daysFromNow(2), start: '13:00', end: '16:00', clinic: 'Clinic C', status: 'approved' },
    // Emma
    { sid: 'S005', date: daysFromNow(3), start: '09:00', end: '12:00', clinic: 'Clinic A', status: 'approved' },
    { sid: 'S005', date: daysFromNow(6), start: '13:00', end: '17:00', clinic: 'Periodontics', status: 'pending' },
  ];

  for (const s of shifts) {
    const studentId = studentIds[s.sid];
    if (!studentId) continue;

    // Check if a shift already exists on this date/time for this student
    const { data: existing } = await db
      .from('shifts')
      .select('id')
      .eq('student_id', studentId)
      .eq('date', s.date)
      .eq('start_time', s.start)
      .single();

    if (existing) {
      console.log(`   ~ ${s.sid} ${s.date} ${s.start} already exists`);
      continue;
    }

    const { error } = await db.from('shifts').insert({
      student_id: studentId,
      date: s.date,
      start_time: s.start,
      end_time: s.end,
      clinic: s.clinic,
      status: s.status,
    });

    if (error) {
      console.error(`   ✗ Shift failed (${s.sid} ${s.date}):`, error.message);
    } else {
      console.log(`   ✓ ${s.sid} ${s.date} ${s.start}–${s.end} [${s.status}]`);
    }
  }

  // ── 4. Ensure settings row exists ────────────────────────────────────────────
  console.log('\n⚙️  Ensuring settings row...');
  await db.from('settings').upsert({
    id: 1,
    max_per_day: 3,
    max_concurrent: 2,
    auto_approve: false,
  });
  console.log('   ✓ Settings row OK');

  console.log('\n✅ Seed complete!\n');
  console.log('Login credentials:');
  console.log(`  Admin:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  students.forEach((s) => {
    console.log(`  Student: ${s.student_id} (${s.name}) — PIN: ${s.pin}`);
  });
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
