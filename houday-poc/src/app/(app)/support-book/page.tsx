import type { Metadata } from 'next';
import Link from 'next/link';
import { MAX_SECTION_LENGTH, SUPPORT_BOOK_SECTIONS } from '@/lib/domain/support-book';
import { requireHousehold } from '@/lib/session';
import { formatUpdatedAt, loadSupportBook } from '@/lib/support-book-data';
import { saveSection } from './actions';

export const metadata: Metadata = { title: 'サポートブック' };

export default async function SupportBookPage() {
  const { supabase, child } = await requireHousehold();
  const entries = await loadSupportBook(supabase, child.id);

  return (
    <>
      <h1>{child.display_name}さんのサポートブック</h1>
      <p className="muted">
        新しいデイや進級のたびに同じ説明をしなくて済むように、少しずつ書き足していきましょう。
        書き直すと前の内容は履歴に残ります。
      </p>
      <p>
        <Link href="/support-book/print">印刷用の表示（PDFで保存できます）</Link>
      </p>

      {SUPPORT_BOOK_SECTIONS.map((s) => {
        const entry = entries.get(s.key);
        return (
          <form key={s.key} action={saveSection} className="card">
            <input type="hidden" name="section" value={s.key} />
            <label htmlFor={`body-${s.key}`}>{s.label}</label>
            <p className="muted">{s.hint}</p>
            <textarea id={`body-${s.key}`} name="body" maxLength={MAX_SECTION_LENGTH} defaultValue={entry?.body ?? ''} />
            <div className="row" style={{ alignItems: 'center' }}>
              <span className="muted">{entry ? `最終更新: ${formatUpdatedAt(entry.updated_at)}` : '未記入'}</span>
              <button type="submit" style={{ flex: '0 0 auto' }}>
                保存
              </button>
            </div>
          </form>
        );
      })}
    </>
  );
}
