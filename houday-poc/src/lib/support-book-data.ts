import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupportBookEntry {
  section: string;
  body: string;
  updated_at: string;
}

export async function loadSupportBook(supabase: SupabaseClient, childId: string) {
  const { data, error } = await supabase
    .from('support_book_entries')
    .select('section, body, updated_at')
    .eq('child_id', childId)
    .returns<SupportBookEntry[]>();
  if (error) throw error;
  return new Map(data.map((e) => [e.section, e]));
}

export function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium' }).format(new Date(iso));
}
