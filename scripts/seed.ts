/**
 * Seed script — populates the database with demo data.
 *
 * Run: npm run seed
 * (Requires .env.local with valid Supabase + admin credentials)
 *
 * Idempotent: running twice won't duplicate records.
 */

import { createClient } from '@supabase/supabase-js';

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

/** Returns a date string N days from today */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('🌱 Seeding OnDeck database...\n');

  // ── 1. Create admin user ────────────────────────────────────────────────────
  console.log(`👤 Creating admin: ${ADMIN_EMAIL}`);
  const { data: existingUsers } = await db.auth.admin.listUsers();
  const adminExists = existingUsers?.users.some((u) => u.email === ADMIN_EMAIL);

  let adminId: string;
  if (adminExists) {
    console.log('   Admin already exists, skipping.');
    adminId = existingUsers!.users.find((u) => u.email === ADMIN_EMAIL)!.id;
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

  await db.from('admins').upsert({ id: adminId, email: ADMIN_EMAIL });
  console.log('   ✓ Admin row upserted\n');

  // ── 2. Seed students (email + password via Supabase Auth) ───────────────────
  const students = [
    { name: 'Alice Mwangi',    student_id: 'S001', email: 'alice.demo@ondeck.dev',  password: 'demoPass2025!', program: 'Dental Hygiene Year 2',   cohort: '2025' },
    { name: 'Bruno Ferreira',  student_id: 'S002', email: 'bruno.demo@ondeck.dev',  password: 'demoPass2025!', program: 'Dental Hygiene Year 1',   cohort: '2026' },
    { name: 'Chloe Okafor',    student_id: 'S003', email: 'chloe.demo@ondeck.dev',  password: 'demoPass2025!', program: 'Dental Assisting Year 2', cohort: '2025' },
    { name: 'David Kim',       student_id: 'S004', email: 'david.demo@ondeck.dev',  password: 'demoPass2025!', program: 'Dental Assisting Year 1', cohort: '2026' },
    { name: 'Emma Johansson',  student_id: 'S005', email: 'emma.demo@ondeck.dev',   password: 'demoPass2025!', program: 'Dental Hygiene Year 2',   cohort: '2025' },
  ];

  console.log('👥 Seeding students...');
  const studentIds: Record<string, string> = {};

  for (const s of students) {
    // Check if student row already exists
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

    // Find or create Supabase Auth user
    const allUsers = (await db.auth.admin.listUsers()).data?.users ?? [];
    let authUser = allUsers.find((u) => u.email === s.email);

    if (!authUser) {
      const { data: created, error: authErr } = await db.auth.admin.createUser({
        email: s.email,
        password: s.password,
        email_confirm: true,
      });
      if (authErr) {
        console.error(`   ✗ Auth user creation failed for ${s.name}:`, authErr.message);
        continue;
      }
      authUser = created.user;
    }

    // Insert student row linked to auth user
    const { data, error } = await db
      .from('students')
      .insert({
        auth_id: authUser.id,
        email: s.email,
        name: s.name,
        student_id: s.student_id,
        program: s.program,
        cohort: s.cohort,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ✗ Failed to insert ${s.name}:`, error.message);
      continue;
    }

    studentIds[s.student_id] = data.id;
    console.log(`   ✓ ${s.name} (${s.student_id}) — ${s.email}`);
  }

  // ── 3. Seed shifts ─────────────────────────────────────────────────────────
  console.log('\n📅 Seeding shifts...');

  const shifts = [
    { sid: 'S001', date: daysFromNow(1),  start: '09:00', end: '12:00', clinic: 'Clinic A',   status: 'approved' },
    { sid: 'S001', date: daysFromNow(3),  start: '13:00', end: '16:00', clinic: 'Clinic B',   status: 'pending'  },
    { sid: 'S001', date: daysFromNow(7),  start: '09:00', end: '12:00', clinic: 'Clinic A',   status: 'pending'  },
    { sid: 'S002', date: daysFromNow(2),  start: '09:00', end: '12:00', clinic: 'Clinic B',   status: 'approved' },
    { sid: 'S002', date: daysFromNow(5),  start: '13:30', end: '17:00', clinic: 'Radiology',  status: 'pending'  },
    { sid: 'S003', date: daysFromNow(1),  start: '13:00', end: '16:00', clinic: 'Ortho Suite', status: 'approved' },
    { sid: 'S003', date: daysFromNow(4),  start: '09:00', end: '12:00', clinic: 'Clinic A',   status: 'pending'  },
    { sid: 'S004', date: daysFromNow(2),  start: '13:00', end: '16:00', clinic: 'Clinic C',   status: 'approved' },
    { sid: 'S005', date: daysFromNow(3),  start: '09:00', end: '12:00', clinic: 'Clinic A',   status: 'approved' },
    { sid: 'S005', date: daysFromNow(6),  start: '13:00', end: '17:00', clinic: 'Periodontics', status: 'pending' },
  ];

  for (const s of shifts) {
    const studentId = studentIds[s.sid];
    if (!studentId) continue;

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

  // ── 4. Ensure settings row ─────────────────────────────────────────────────
  console.log('\n⚙️  Ensuring settings row...');
  await db.from('settings').upsert({ id: 1, max_per_day: 3, max_concurrent: 2, auto_approve: false });
  console.log('   ✓ Settings row OK');

  console.log('\n✅ Seed complete!\n');
  console.log('Login credentials:');
  console.log(`  Admin:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  students.forEach((s) => {
    console.log(`  Student: ${s.name} (${s.student_id}) — ${s.email} / ${s.password}`);
  });
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
