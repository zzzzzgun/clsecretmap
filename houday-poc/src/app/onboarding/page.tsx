import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { createHousehold } from './actions';

export const metadata: Metadata = { title: 'はじめに' };

export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership) redirect('/calendar');

  const { error } = await searchParams;

  return (
    <main>
      <h1>はじめに</h1>
      {error === 'consent' && (
        <p className="notice danger">ご利用には、プライバシーポリシーへの同意が必要です。</p>
      )}

      <form action={createHousehold} className="card">
        <label htmlFor="child_name">お子さんの呼び名</label>
        <input id="child_name" name="child_name" type="text" maxLength={40} required placeholder="例: たろう" />
        <p className="muted">本名でなくてもかまいません。共有した相手にはこの名前が表示されます。</p>

        <h2>大切な情報の取り扱いについて</h2>
        <p>
          このアプリには、お子さんの特性や配慮してほしいこと、医療に関することなど、
          障害や発達に関わる情報を記録できます。これらは法律上「要配慮個人情報」にあたります。
        </p>
        <ul>
          <li>記録した内容は、あなたのご家庭の中だけで保存されます。</li>
          <li>学校やデイに共有するのは、あなたが共有リンクを作ったときだけです。項目と期限はあなたが選べます。</li>
          <li>記録はいつでも印刷・PDFにして持ち出せます。</li>
          <li>データは日本国内のサーバーに保存します。</li>
          <li>このアプリは試験運用中（PoC）です。</li>
        </ul>
        <label className="inline">
          <input type="checkbox" name="consent" value="yes" required />
          <span>
            <Link href="/privacy" target="_blank">プライバシーポリシー</Link>
            を読み、お子さんの情報（要配慮個人情報を含む）をこのアプリで取り扱うことに、保護者として同意します。
          </span>
        </label>
        <button type="submit">同意して始める</button>
      </form>
    </main>
  );
}
