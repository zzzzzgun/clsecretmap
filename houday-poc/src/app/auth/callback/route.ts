import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// メールのログインリンクから戻ってくる場所。code をセッションに交換する
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${env.siteUrl}/calendar`);
  }
  return NextResponse.redirect(`${env.siteUrl}/login?error=link`);
}
