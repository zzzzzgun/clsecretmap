import Link from 'next/link';

// ログイン後の画面に共通の下部ナビゲーション
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main>{children}</main>
      <nav className="tabbar" aria-label="メインメニュー">
        <Link href="/calendar">カレンダー</Link>
        <Link href="/support-book">サポートブック</Link>
        <Link href="/share">共有</Link>
        <Link href="/settings">設定</Link>
      </nav>
    </>
  );
}
