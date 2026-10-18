import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

/** ログイン中の利用者として DB にアクセスする（RLS が効く）。リクエストごとに作ること。 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component からは cookie を書けない。セッションの更新は proxy.ts が行う。
        }
      },
    },
  });
}

/** 未ログインの閲覧者用（共有ページ）。cookie を読まず、get_shared_view() だけを呼ぶ。 */
export function createSupabaseAnonClient() {
  return createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
