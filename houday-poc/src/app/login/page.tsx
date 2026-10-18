import type { Metadata } from 'next';
import Link from 'next/link';
import { sendLoginLink } from './actions';

export const metadata: Metadata = { title: 'ログイン' };

const ERRORS: Record<string, string> = {
  email: 'メールアドレスの形式が正しくありません。',
  send: 'メールを送れませんでした。時間をおいてもう一度お試しください。',
  link: 'ログインリンクが無効か、期限が切れています。もう一度メールを送ってください。',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { sent, error } = await searchParams;
  const errorMessage = typeof error === 'string' ? ERRORS[error] : undefined;

  return (
    <main>
      <h1>デイ手帳</h1>
      <p>放課後等デイサービスの利用日と、お子さんのサポートブックを、保護者の手元にひとつにまとめます。</p>

      {sent && <p className="notice info">ログイン用のリンクをメールで送りました。メールを開いてリンクを押してください。</p>}
      {errorMessage && <p className="notice danger">{errorMessage}</p>}

      <form action={sendLoginLink} className="card">
        <label htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <button type="submit">ログインリンクを送る</button>
        <p className="muted">パスワードは不要です。初めての方も同じ手順で登録できます。</p>
      </form>

      <p className="muted">
        <Link href="/privacy">プライバシーポリシー</Link>
      </p>
    </main>
  );
}
