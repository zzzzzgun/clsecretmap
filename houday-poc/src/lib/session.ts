import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface Child {
  id: string;
  display_name: string;
  school_name: string | null;
  school_grade: string | null;
}

/** ログインしていなければ /login へ */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  return { supabase, user: data.user };
}

/**
 * ログイン済みで、家庭の登録まで済んでいることを確かめる。
 * PoC では1家庭・子ども1人を前提にする（きょうだい対応は第2段）。
 */
export async function requireHousehold() {
  const { supabase, user } = await requireUser();

  const { data: membership, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!membership) redirect('/onboarding');

  const { data: child, error: childError } = await supabase
    .from('children')
    .select('id, display_name, school_name, school_grade')
    .eq('household_id', membership.household_id)
    .order('created_at')
    .limit(1)
    .single<Child>();
  if (childError) throw childError;

  return { supabase, user, householdId: membership.household_id as string, child };
}
