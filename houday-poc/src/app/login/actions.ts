'use server';

import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { text } from '@/lib/form';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// パスワードなし。メールに届くリンクでログインする
export async function sendLoginLink(form: FormData) {
  const email = text(form, 'email', { max: 254, required: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/login?error=email');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback` },
  });
  if (error) redirect('/login?error=send');
  redirect('/login?sent=1');
}
