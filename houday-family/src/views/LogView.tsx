import { formatJapaneseDate, todayInTokyo } from '@domain/dates';
import { useState, type FormEvent } from 'react';
import { FacilitySelect, StoredPhoto, field } from '../components';
import type { Child } from '../model';
import { compressPhoto } from '../photo';
import { deletePhoto, putPhoto } from '../storage';
import { newId, useStore } from '../store';

// どのデイの連絡帳も、ここに時系列でまとめる
export function LogView({ child }: { child: Child }) {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const facilityById = new Map(state.facilities.map((f) => [f.id, f]));
  // 記録するのはたいてい今日行ったデイの様子なので、それを初期値にする
  const today = todayInTokyo();
  const todaysFacility = state.plans.find(
    (p) => p.childId === child.id && p.date === today && p.status === 'planned' && !facilityById.get(p.facilityId)?.archived,
  )?.facilityId;
  const logs = state.logs
    .filter((l) => l.childId === child.id)
    .filter((l) => filter === 'all' || (l.facilityId ?? 'home') === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const text = field(form, 'text');
    const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
    if (!text && files.length === 0) {
      setError('内容か写真を入れてください。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const photoIds: string[] = [];
      for (const file of files) {
        const id = newId();
        await putPhoto(id, await compressPhoto(file));
        photoIds.push(id);
      }
      dispatch({
        type: 'addLog',
        log: {
          id: newId(),
          childId: child.id,
          date: field(form, 'date'),
          facilityId: field(form, 'facilityId') || null,
          text,
          photoIds,
          createdAt: new Date().toISOString(),
        },
      });
      formEl.reset();
    } catch {
      setError('写真を保存できませんでした。端末の空き容量を確かめてください。');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, photoIds: string[]) {
    if (!window.confirm('この記録を削除しますか？写真も消えます。')) return;
    dispatch({ type: 'removeLog', id });
    await Promise.all(photoIds.map(deletePhoto));
  }

  return (
    <>
      <p className="muted">デイの連絡帳や、迎えのときに聞いたことを残しておくと、どのデイの様子もここで続けて振り返れます。</p>

      <form onSubmit={add} className="card">
        <div className="row">
          <div>
            <label htmlFor="log-date">日付</label>
            <input id="log-date" name="date" type="date" required defaultValue={today} />
          </div>
          <div>
            <label htmlFor="log-facility">どこで</label>
            <FacilitySelect id="log-facility" allowNone defaultId={todaysFacility} childId={child.id} />
          </div>
        </div>
        <label htmlFor="log-text">様子</label>
        <textarea id="log-text" name="text" maxLength={4000} placeholder="例: 公園で鬼ごっこ。初めて自分から友だちを誘えた" />
        <label htmlFor="log-photos">連絡帳などの写真</label>
        <input id="log-photos" name="photos" type="file" accept="image/*" multiple />
        {error && <p className="notice danger">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? '保存中…' : '記録する'}
        </button>
      </form>

      <div className="row" style={{ alignItems: 'center' }}>
        <label htmlFor="log-filter" style={{ margin: 0, flex: '0 0 auto' }}>
          絞り込み
        </label>
        <select id="log-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">すべて</option>
          {state.facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
          <option value="home">デイ以外・家</option>
        </select>
      </div>

      {logs.length === 0 && <p className="muted">まだ記録がありません。</p>}
      {logs.map((l) => {
        const f = l.facilityId ? facilityById.get(l.facilityId) : undefined;
        return (
          <article key={l.id} className="card">
            <div className="row" style={{ alignItems: 'center' }}>
              <strong>
                {formatJapaneseDate(l.date)} {f ? <><span className="swatch" style={{ background: f.color }} />{f.name}</> : 'デイ以外・家'}
              </strong>
              <span className="actions">
                <button className="small danger" onClick={() => remove(l.id, l.photoIds)}>
                  削除
                </button>
              </span>
            </div>
            {l.text && <p style={{ whiteSpace: 'pre-wrap' }}>{l.text}</p>}
            {l.photoIds.length > 0 && (
              <div className="photos">
                {l.photoIds.map((id) => (
                  <StoredPhoto key={id} id={id} alt={`${formatJapaneseDate(l.date)}の写真`} />
                ))}
              </div>
            )}
          </article>
        );
      })}
    </>
  );
}
