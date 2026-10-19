import { useEffect, useRef, useState, type FormEvent } from 'react';
import { backupFileName, base64ToBlob, blobToBase64, buildBackup, parseBackup, type BackupPhoto } from '../backup';
import { field, formatDateTime } from '../components';
import type { Child } from '../model';
import { allPhotoIds, clearPhotos, getPhoto, putPhoto } from '../storage';
import { newId, useStore } from '../store';
import { FacilityTimesForm, SchoolBreaksForm, SchoolTimesForm } from './SchoolSettings';

export function SettingsView({ child, onSelectChild }: { child: Child; onSelectChild: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const certificates = state.certificates
    .filter((c) => c.childId === child.id)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));

  function addFacility(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = field(new FormData(e.currentTarget), 'name');
    if (!name) return;
    dispatch({ type: 'addFacility', id: newId(), name });
    e.currentTarget.reset();
  }

  function addCertificate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const validFrom = field(form, 'validFrom');
    const validUntil = field(form, 'validUntil');
    if (validUntil < validFrom) {
      window.alert('有効期間の終わりが始まりより前になっています。');
      return;
    }
    dispatch({
      type: 'addCertificate',
      certificate: { id: newId(), childId: child.id, validFrom, validUntil, monthlyDays: Number(field(form, 'monthlyDays')) },
    });
    e.currentTarget.reset();
  }

  function saveChild(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = field(form, 'name');
    if (!name) return;
    dispatch({ type: 'updateChild', child: { ...child, name, school: field(form, 'school'), grade: field(form, 'grade') } });
  }

  function addSibling(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = field(new FormData(e.currentTarget), 'name');
    if (!name) return;
    const id = newId();
    dispatch({ type: 'addChild', child: { id, name, school: '', grade: '' } });
    onSelectChild(id);
    e.currentTarget.reset();
  }

  function removeChild() {
    if (state.children.length <= 1) return;
    if (!window.confirm(`${child.name}さんの予定・記録・サポートブックを全て削除します。元に戻せません。よろしいですか？`)) return;
    dispatch({ type: 'removeChild', childId: child.id });
    onSelectChild(state.children.find((c) => c.id !== child.id)!.id);
  }

  return (
    <>
      <h2>通っているデイ</h2>
      <div className="card">
        {state.facilities.length === 0 && <p className="muted">まだ登録されていません。</p>}
        <ul className="plan-list">
          {state.facilities.map((f) => (
            <li key={f.id} className={f.archived ? 'facility-item cancelled' : 'facility-item'}>
              <span className="what">
                <span className="swatch" style={{ background: f.color }} />
                {f.name}
                {f.archived && '（通っていない）'}
                {!f.archived && <FacilityTimesForm facility={f} />}
              </span>
              <button
                className="small secondary"
                onClick={() => dispatch({ type: 'setFacilityArchived', id: f.id, archived: !f.archived })}
              >
                {f.archived ? '戻す' : 'やめた'}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addFacility}>
          <label htmlFor="facility-name">デイを追加</label>
          <input id="facility-name" name="name" type="text" maxLength={80} required placeholder="例: ひまわり放課後デイ" />
          <button type="submit">追加</button>
        </form>
      </div>

      <h2>{child.name}さんの受給者証</h2>
      <div className="card">
        <p className="muted">支給日数（1か月に使える日数）と有効期間を入れると、残りの日数と更新時期をお知らせします。</p>
        <ul className="plan-list">
          {certificates.map((c) => (
            <li key={c.id}>
              <span className="what">
                {c.validFrom} 〜 {c.validUntil}・月{c.monthlyDays}日
              </span>
              <button className="small danger" onClick={() => dispatch({ type: 'removeCertificate', id: c.id })}>
                削除
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCertificate}>
          <div className="row">
            <div>
              <label htmlFor="cert-from">有効期間（から）</label>
              <input id="cert-from" name="validFrom" type="date" required />
            </div>
            <div>
              <label htmlFor="cert-until">有効期間（まで）</label>
              <input id="cert-until" name="validUntil" type="date" required />
            </div>
            <div>
              <label htmlFor="cert-days">支給日数（日/月）</label>
              <input id="cert-days" name="monthlyDays" type="number" min={1} max={31} required />
            </div>
          </div>
          <button type="submit">受給者証を登録</button>
        </form>
      </div>

      <h2>{child.name}さんの学校の時間</h2>
      <SchoolTimesForm child={child} />

      <h2>学校が休みの期間</h2>
      <SchoolBreaksForm child={child} />

      <h2>お子さん</h2>
      <form key={child.id} onSubmit={saveChild} className="card">
        <label htmlFor="child-name">呼び名</label>
        <input id="child-name" name="name" type="text" maxLength={40} required defaultValue={child.name} />
        <div className="row">
          <div>
            <label htmlFor="child-school">学校</label>
            <input id="child-school" name="school" type="text" maxLength={80} defaultValue={child.school} />
          </div>
          <div>
            <label htmlFor="child-grade">学年</label>
            <input id="child-grade" name="grade" type="text" maxLength={20} defaultValue={child.grade} placeholder="例: 小3" />
          </div>
        </div>
        <div className="actions">
          <button type="submit">保存</button>
          {state.children.length > 1 && (
            <button type="button" className="danger" onClick={removeChild}>
              {child.name}さんを削除
            </button>
          )}
        </div>
      </form>
      <form onSubmit={addSibling} className="card">
        <label htmlFor="sibling-name">きょうだいを追加</label>
        <input id="sibling-name" name="name" type="text" maxLength={40} required placeholder="呼び名" />
        <button type="submit">追加</button>
      </form>

      <BackupSection />
    </>
  );
}

const BACKUP_REMINDER_DAYS = 30;

function BackupSection() {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'danger'; text: string } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const daysSinceBackup = state.lastBackupAt
    ? Math.floor((Date.now() - Date.parse(state.lastBackupAt)) / 86_400_000)
    : null;

  async function exportBackup() {
    setBusy(true);
    setMessage(null);
    try {
      const photos: BackupPhoto[] = [];
      for (const id of await allPhotoIds()) {
        const blob = await getPhoto(id);
        if (blob) photos.push({ id, type: blob.type || 'image/jpeg', data: await blobToBase64(blob) });
      }
      const now = new Date();
      const file = new Blob([JSON.stringify(buildBackup(state, photos, now))], { type: 'application/json' });
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(now);
      a.click();
      // すぐに解放するとダウンロードが始まらないブラウザがある
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      dispatch({ type: 'markBackedUp', at: now.toISOString() });
      setMessage({ kind: 'info', text: 'バックアップを書き出しました。iCloud Drive や Google ドライブなど、この端末以外の場所にも保存しておいてください。' });
    } catch {
      setMessage({ kind: 'danger', text: 'バックアップを書き出せませんでした。' });
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file: File) {
    setMessage(null);
    try {
      const backup = parseBackup(await file.text());
      const ok = window.confirm(
        `${formatDateTime(backup.exportedAt)} のバックアップで、今のデータを全て置き換えます。よろしいですか？`,
      );
      if (!ok) return;
      setBusy(true);
      await clearPhotos();
      for (const p of backup.photos) await putPhoto(p.id, base64ToBlob(p.data, p.type));
      dispatch({ type: 'replaceAll', state: backup.state });
      setMessage({ kind: 'info', text: 'バックアップから戻しました。' });
    } catch (e) {
      setMessage({ kind: 'danger', text: e instanceof Error ? e.message : '読み込めませんでした。' });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <>
      <h2>バックアップ</h2>
      <div className="card">
        <p>
          データはこの端末の中だけに保存されていて、どこにも送られません。そのため、機種変更やブラウザのデータ削除で消えることがあります。
          <strong>月に1回はバックアップを書き出してください。</strong>
        </p>
        {daysSinceBackup === null && <p className="notice warn">まだバックアップがありません。</p>}
        {daysSinceBackup !== null && daysSinceBackup >= BACKUP_REMINDER_DAYS && (
          <p className="notice warn">前回のバックアップから{daysSinceBackup}日たっています。</p>
        )}
        {daysSinceBackup !== null && daysSinceBackup < BACKUP_REMINDER_DAYS && (
          <p className="muted">前回のバックアップ: {formatDateTime(state.lastBackupAt!)}</p>
        )}
        {persisted === false && (
          <p className="muted">
            このブラウザでは、容量が足りなくなったときにデータが消される可能性があります。ホーム画面に追加して使うと消されにくくなります。
          </p>
        )}
        {message && <p className={`notice ${message.kind}`}>{message.text}</p>}
        <div className="actions">
          <button type="button" onClick={exportBackup} disabled={busy}>
            バックアップを書き出す
          </button>
          <button type="button" className="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            バックアップから戻す
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importBackup(f);
          }}
        />
      </div>
    </>
  );
}
