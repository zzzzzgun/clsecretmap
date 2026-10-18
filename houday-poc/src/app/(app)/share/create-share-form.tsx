'use client';

import { useActionState, useState } from 'react';
import { SUPPORT_BOOK_SECTIONS } from '@/lib/domain/support-book';
import { createShareLink, type CreateShareState } from './actions';

const DURATIONS = [
  { days: 7, label: '1週間' },
  { days: 30, label: '1か月' },
  { days: 90, label: '3か月' },
  { days: 365, label: '1年' },
];

export function CreateShareForm() {
  const [state, action, pending] = useActionState<CreateShareState, FormData>(createShareLink, {});
  const [copied, setCopied] = useState(false);

  return (
    <>
      {state.url && (
        <div className="notice info">
          <p>
            <strong>{state.label}</strong> 向けの共有リンクを作りました。このURLは今だけ表示されます。
            LINE やメールで相手に送ってください。
          </p>
          <p className="share-url">{state.url}</p>
          <button
            type="button"
            className="small"
            onClick={async () => {
              await navigator.clipboard.writeText(state.url!);
              setCopied(true);
            }}
          >
            {copied ? 'コピーしました' : 'URLをコピー'}
          </button>
        </div>
      )}
      {state.error && <p className="notice danger">{state.error}</p>}

      <form action={action} className="card" onSubmit={() => setCopied(false)}>
        <label htmlFor="label">共有する相手</label>
        <input id="label" name="label" type="text" maxLength={60} required placeholder="例: 3年2組 担任の先生" />

        <label>共有する項目</label>
        <label className="inline">
          <input type="checkbox" name="scope" value="schedule" defaultChecked />
          今後2週間のデイの予定（どのデイが何時に迎えに来るか）
        </label>
        {SUPPORT_BOOK_SECTIONS.map((s) => (
          <label key={s.key} className="inline">
            <input type="checkbox" name="scope" value={`sb:${s.key}`} />
            サポートブック: {s.label}
          </label>
        ))}

        <label htmlFor="days">見られる期間</label>
        <select id="days" name="days" defaultValue="90">
          {DURATIONS.map((d) => (
            <option key={d.days} value={d.days}>
              {d.label}
            </option>
          ))}
        </select>

        <button type="submit" disabled={pending}>
          {pending ? '作成中…' : '共有リンクを作る'}
        </button>
      </form>
    </>
  );
}
