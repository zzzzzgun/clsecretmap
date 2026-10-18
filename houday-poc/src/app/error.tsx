'use client';

// 本番ではサーバー側のエラー内容は画面に出ない（Next.js の仕様）。原因はサーバーのログで確認する。
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <h1>うまくいきませんでした</h1>
      <p className="notice danger">入力内容を確かめて、もう一度お試しください。</p>
      {error.digest && <p className="muted">エラー番号: {error.digest}</p>}
      <button onClick={reset}>もう一度試す</button>
    </main>
  );
}
