import { useRef, useState } from 'react';
import { BACKUP_REMINDER_DAYS, backupFileName, buildBackup, daysSince, mergeRecipes, parseBackup, type BackupFile } from '../backup';
import { ConfirmDialog, Modal } from '../components';
import { paths } from '../router';
import { useStore } from '../store';

type RestoreMode = 'merge' | 'replace';

export function BackupView() {
  const { recipes, dispatch, toast, lastBackupAt, markBackedUp } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const days = daysSince(lastBackupAt, new Date());
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof File === 'function';

  function makeFile(): File {
    const now = new Date();
    return new File([JSON.stringify(buildBackup(recipes, now), null, 1)], backupFileName(now), { type: 'application/json' });
  }

  function download() {
    const file = makeFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    markBackedUp();
    toast('バックアップファイルを保存しました');
  }

  async function save() {
    setError(null);
    const file = makeFile();
    // iPhone などは共有メニューから「ファイルに保存」や iCloud Drive・LINE に送れる
    if (canShareFiles && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'レシピのバックアップ' });
        markBackedUp();
        toast('バックアップを保存しました');
      } catch (e) {
        // 共有メニューを閉じただけのときは何もしない
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError('共有できませんでした。「ファイルとしてダウンロード」を試してください。');
      }
      return;
    }
    download();
  }

  async function onFile(file: File) {
    setError(null);
    try {
      setPending(parseBackup(await file.text()));
      setMode('merge');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルを読み取れませんでした。');
    }
  }

  function restore(backup: BackupFile, how: RestoreMode) {
    if (how === 'replace') {
      dispatch({ type: 'replaceAll', recipes: backup.recipes });
      toast(`バックアップで置き換えました（${backup.recipes.length}件）`);
    } else {
      const r = mergeRecipes(recipes, backup.recipes);
      dispatch({ type: 'replaceAll', recipes: r.recipes });
      toast(`追加 ${r.added}件・更新 ${r.updated}件・変更なし ${r.unchanged}件`);
    }
    setPending(null);
    setConfirmReplace(false);
  }

  const preview = pending ? mergeRecipes(recipes, pending.recipes) : null;

  return (
    <main>
      <nav className="topbar">
        <a href={paths.list} className="back">
          ← 一覧へ
        </a>
      </nav>
      <h1>バックアップ</h1>

      <p className="muted">
        レシピはこの端末の中だけに保存されています。機種変更や、ブラウザのデータを消したときに備えて、ファイルにして端末の外（iCloud Drive・Google
        ドライブなど）に残しておきましょう。家族の端末にファイルを渡して読み込めば、同じレシピを入れることもできます。
      </p>

      <section className="card">
        <h2>バックアップを保存する</h2>
        <p className="backup-status">
          今のレシピ：<strong>{recipes.length}件</strong>
          <br />
          前回のバックアップ：
          {lastBackupAt ? (
            <strong className={days !== null && days >= BACKUP_REMINDER_DAYS ? 'warn-text' : ''}>
              {formatDateTime(lastBackupAt)}（{days === 0 ? '今日' : `${days}日前`}）
            </strong>
          ) : (
            <strong className="warn-text">まだありません</strong>
          )}
        </p>
        <div className="backup-actions">
          <button type="button" onClick={() => void save()} disabled={recipes.length === 0}>
            💾 バックアップを保存
          </button>
          {canShareFiles && (
            <button type="button" className="secondary" onClick={download} disabled={recipes.length === 0}>
              ファイルとしてダウンロード
            </button>
          )}
        </div>
        <ul className="hint muted backup-howto">
          <li>iPhone：共有メニューで「"ファイル"に保存」→ iCloud Drive を選ぶと、機種変更しても残ります。</li>
          <li>Android：ダウンロードしたファイルを Google ドライブなどにも入れておくと安心です。</li>
        </ul>
      </section>

      <section className="card">
        <h2>バックアップから戻す</h2>
        <p className="muted">保存しておいたバックアップファイル（.json）を選ぶと、読み込む前に内容を確認できます。</p>
        <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
          📂 バックアップファイルを選ぶ
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json,text/plain"
          hidden
          aria-label="バックアップファイル"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onFile(f);
          }}
        />
      </section>

      {error && (
        <p className="error summary" role="alert">
          {error}
        </p>
      )}

      {pending && preview && (
        <Modal
          title="バックアップから戻す"
          onClose={() => setPending(null)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setPending(null)}>
                キャンセル
              </button>
              <button
                type="button"
                className={mode === 'replace' ? 'danger-fill' : ''}
                onClick={() => (mode === 'replace' ? setConfirmReplace(true) : restore(pending, 'merge'))}
              >
                {mode === 'replace' ? '置き換える' : '読み込む'}
              </button>
            </>
          }
        >
          <p className="backup-file-info">
            {formatDateTime(pending.exportedAt)} に保存したバックアップ
            <br />
            レシピ <strong>{pending.recipes.length}件</strong>
          </p>
          <div className="restore-modes" role="radiogroup" aria-label="読み込み方">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'merge'}
              className={`restore-mode ${mode === 'merge' ? 'on' : ''}`}
              onClick={() => setMode('merge')}
            >
              <strong>今のレシピに追加する（おすすめ）</strong>
              <span>
                新しく追加 {preview.added}件・更新 {preview.updated}件・変更なし {preview.unchanged}件。
                同じレシピは新しく編集したほうを残し、評価は両方を合わせます。今のレシピは消えません。
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'replace'}
              className={`restore-mode danger ${mode === 'replace' ? 'on' : ''}`}
              onClick={() => setMode('replace')}
            >
              <strong>今のレシピをすべて置き換える</strong>
              <span>
                今の{recipes.length}件を消して、バックアップの{pending.recipes.length}件だけにします。
              </span>
            </button>
          </div>
        </Modal>
      )}

      {pending && confirmReplace && (
        <ConfirmDialog
          title="すべて置き換えますか？"
          message={
            <>
              <p>今のレシピ {recipes.length}件を消して、バックアップの {pending.recipes.length}件に置き換えます。</p>
              <p>バックアップに入っていないレシピや評価は元に戻せません。</p>
            </>
          }
          confirmLabel="置き換える"
          danger
          onCancel={() => setConfirmReplace(false)}
          onConfirm={() => restore(pending, 'replace')}
        />
      )}
    </main>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
