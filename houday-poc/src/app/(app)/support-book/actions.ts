'use server';

import { revalidatePath } from 'next/cache';
import { isSupportBookSection, MAX_SECTION_LENGTH } from '@/lib/domain/support-book';
import { text } from '@/lib/form';
import { requireHousehold } from '@/lib/session';

export async function saveSection(form: FormData) {
  const section = text(form, 'section', { max: 20, required: true });
  if (!isSupportBookSection(section)) throw new Error('項目が正しくありません');
  const body = text(form, 'body', { max: MAX_SECTION_LENGTH });

  const { supabase, householdId, child } = await requireHousehold();
  // 更新の場合は DB のトリガーが前の内容を履歴に残す
  const { error } = await supabase
    .from('support_book_entries')
    .upsert(
      { household_id: householdId, child_id: child.id, section, body },
      { onConflict: 'child_id,section' },
    );
  if (error) throw error;
  revalidatePath('/support-book');
}
