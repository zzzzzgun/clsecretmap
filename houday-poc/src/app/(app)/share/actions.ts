'use server';

import { revalidatePath } from 'next/cache';
import { env } from '@/lib/env';
import { generateShareToken, hashShareToken, isShareScope, shareExpiry } from '@/lib/domain/share';
import { text, uuid } from '@/lib/form';
import { requireHousehold } from '@/lib/session';

export type CreateShareState = { url?: string; label?: string; error?: string };

export async function createShareLink(_prev: CreateShareState, form: FormData): Promise<CreateShareState> {
  let label: string;
  try {
    label = text(form, 'label', { max: 60, required: true });
  } catch {
    return { error: '共有する相手の名前を60文字以内で入れてください。' };
  }
  const scopes = form.getAll('scope').filter((s): s is string => typeof s === 'string' && isShareScope(s));
  if (scopes.length === 0) return { error: '共有する項目を1つ以上選んでください。' };

  const { supabase, householdId, child } = await requireHousehold();
  const token = generateShareToken();
  const { error } = await supabase.from('share_links').insert({
    household_id: householdId,
    child_id: child.id,
    token_hash: hashShareToken(token),
    label,
    scopes: [...new Set(scopes)],
    expires_at: shareExpiry(Number(form.get('days'))).toISOString(),
  });
  if (error) return { error: '共有リンクを作れませんでした。もう一度お試しください。' };

  revalidatePath('/share');
  // トークンはここで一度だけ返す。DB にはハッシュしか残らない
  return { url: `${env.siteUrl}/s/${token}`, label };
}

export async function revokeShareLink(form: FormData) {
  const { supabase } = await requireHousehold();
  const { error } = await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', uuid(form, 'id'))
    .is('revoked_at', null);
  if (error) throw error;
  revalidatePath('/share');
}
