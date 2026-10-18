import { MAX_SECTION_LENGTH, SUPPORT_BOOK_SECTIONS, type SupportBookSection } from '@domain/support-book';
import { useState, type FormEvent } from 'react';
import { formatDateTime, field } from '../components';
import type { Child } from '../model';
import { useStore } from '../store';

export function SupportBookView({ child }: { child: Child }) {
  const { state, dispatch } = useStore();
  const book = state.supportBook[child.id] ?? {};
  const [printing, setPrinting] = useState(false);
  const [savedSection, setSavedSection] = useState<SupportBookSection | null>(null);

  function save(section: SupportBookSection, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = field(new FormData(e.currentTarget), 'body');
    dispatch({ type: 'saveSupportBook', childId: child.id, section, body, now: new Date().toISOString() });
    setSavedSection(section);
    setTimeout(() => setSavedSection((s) => (s === section ? null : s)), 2000);
  }

  function print() {
    setPrinting(true);
    // 印刷用の表示に切り替えてから印刷する
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  }

  if (printing) {
    return (
      <div className="print-only-view">
        <h1>{child.name}さんのサポートブック</h1>
        <p className="muted">{[child.school, child.grade].filter(Boolean).join(' ')}</p>
        {SUPPORT_BOOK_SECTIONS.map((s) => {
          const item = book[s.key];
          if (!item?.body) return null;
          return (
            <section key={s.key} className="card">
              <h2 style={{ marginTop: 0 }}>{s.label}</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p>
              <p className="muted">最終更新: {formatDateTime(item.updatedAt)}</p>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <p className="muted">
        新しいデイや進級のたびに同じ説明をしなくて済むように、少しずつ書き足していきましょう。書き直すと前の内容は履歴に残ります。
      </p>
      <button type="button" onClick={print}>
        印刷 / PDFで保存
      </button>

      {SUPPORT_BOOK_SECTIONS.map((s) => {
        const item = book[s.key];
        return (
          // 子どもを切り替えたら入力欄を作り直す（key に子どもの ID を含める）
          <form key={`${child.id}-${s.key}`} onSubmit={(e) => save(s.key, e)} className="card">
            <label htmlFor={`sb-${s.key}`}>{s.label}</label>
            <p className="muted">{s.hint}</p>
            <textarea id={`sb-${s.key}`} name="body" maxLength={MAX_SECTION_LENGTH} defaultValue={item?.body ?? ''} />
            <div className="row" style={{ alignItems: 'center' }}>
              <span className="muted">
                {savedSection === s.key ? '保存しました' : item ? `最終更新: ${formatDateTime(item.updatedAt)}` : '未記入'}
              </span>
              <button type="submit" style={{ flex: '0 0 auto' }}>
                保存
              </button>
            </div>
            {item && item.history.length > 0 && (
              <details>
                <summary className="muted">これまでの内容（{item.history.length}件）</summary>
                {item.history.map((h) => (
                  <div key={h.updatedAt} className="history">
                    <p className="muted">{formatDateTime(h.updatedAt)}まで</p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{h.body || '（空欄）'}</p>
                  </div>
                ))}
              </details>
            )}
          </form>
        );
      })}
    </>
  );
}
