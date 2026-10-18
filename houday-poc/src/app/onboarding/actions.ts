'use server';

import { redirect } from 'next/navigation';
import { text } from '@/lib/form';
import { POLICY_VERSION } from '@/lib/policy';
import { requireUser } from '@/lib/session';

export async function createHousehold(form: FormData) {
  // 要配慮個人情報を預かる前に、明示的な同意を必ず取る
  if (form.get('consent') !== 'yes') redirect('/onboarding?error=consent');
  const childName = text(form, 'child_name', { max: 40, required: true });

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('create_household', {
    p_child_name: childName,
    p_policy_version: POLICY_VERSION,
  });
  // 既に登録済み（別の端末で先に登録した等）ならそのまま進める
  if (error && error.code !== '23505') throw error;

  redirect('/settings?welcome=1');
}
