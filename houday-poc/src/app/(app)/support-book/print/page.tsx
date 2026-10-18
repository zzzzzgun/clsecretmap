import type { Metadata } from 'next';
import { SUPPORT_BOOK_SECTIONS } from '@/lib/domain/support-book';
import { requireHousehold } from '@/lib/session';
import { formatUpdatedAt, loadSupportBook } from '@/lib/support-book-data';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'サポートブック（印刷用）' };

// 自分のデータはいつでも無料で持ち出せる（ブラウザの印刷から PDF に保存）
export default async function SupportBookPrintPage() {
  const { supabase, child } = await requireHousehold();
  const entries = await loadSupportBook(supabase, child.id);

  return (
    <>
      <h1>{child.display_name}さんのサポートブック</h1>
      <p className="muted">
        {child.school_name && `${child.school_name} `}
        {child.school_grade}
      </p>
      <PrintButton />
      {SUPPORT_BOOK_SECTIONS.map((s) => {
        const entry = entries.get(s.key);
        if (!entry?.body) return null;
        return (
          <section key={s.key} className="card">
            <h2 style={{ marginTop: 0 }}>{s.label}</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</p>
            <p className="muted">最終更新: {formatUpdatedAt(entry.updated_at)}</p>
          </section>
        );
      })}
    </>
  );
}
