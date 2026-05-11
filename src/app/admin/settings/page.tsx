import { createServerClient } from '@/lib/supabase/server';
import { SettingsForm } from './SettingsForm';
import { AdminUsersSection } from '@/components/AdminUsersSection';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const db = createServerClient();
  const { data } = await db.from('settings').select('*').single();
  const settings = data as Settings;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <div className="max-w-lg space-y-6">
        <SettingsForm settings={settings} />
        <AdminUsersSection />
      </div>
    </div>
  );
}
