import { useState, type FormEvent } from 'react';
import { field } from './components';
import { newId, useStore } from './store';
import { CalendarView } from './views/CalendarView';
import { LogView } from './views/LogView';
import { MessagesView } from './views/MessagesView';
import { SettingsView } from './views/SettingsView';
import { SupportBookView } from './views/SupportBookView';

const TABS = [
  { key: 'calendar', label: 'カレンダー' },
  { key: 'log', label: '様子' },
  { key: 'book', label: 'サポートブック' },
  { key: 'messages', label: '連絡' },
  { key: 'settings', label: '設定' },
] as const;

type Tab = (typeof TABS)[number]['key'];

// 選んでいる子ども・タブは、この端末の中で覚えておく（消えても困らない）
function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても動作には影響しない
  }
}

export function App() {
  const { state, saveError } = useStore();
  const [tab, setTabState] = useState<Tab>(() => (TABS.find((t) => t.key === remembered('tab'))?.key ?? 'calendar'));
  const [childId, setChildIdState] = useState<string | null>(() => remembered('childId'));

  const setTab = (t: Tab) => {
    setTabState(t);
    remember('tab', t);
    window.scrollTo(0, 0);
  };
  const setChildId = (id: string) => {
    setChildIdState(id);
    remember('childId', id);
  };

  if (state.children.length === 0) return <FirstRun onCreated={setChildId} onDone={() => setTab('settings')} />;

  const child = state.children.find((c) => c.id === childId) ?? state.children[0];

  return (
    <>
      <header className="app-header no-print">
        <strong>デイ手帳</strong>
        {state.children.length > 1 ? (
          <select aria-label="お子さんを選ぶ" value={child.id} onChange={(e) => setChildId(e.target.value)}>
            {state.children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}さん
              </option>
            ))}
          </select>
        ) : (
          <span>{child.name}さん</span>
        )}
      </header>
      <main>
        {saveError && <p className="notice danger">{saveError}</p>}
        <h1 className="no-print">{TABS.find((t) => t.key === tab)?.label}</h1>
        {tab === 'calendar' && <CalendarView child={child} goTo={setTab} />}
        {tab === 'log' && <LogView child={child} />}
        {tab === 'book' && <SupportBookView child={child} />}
        {tab === 'messages' && <MessagesView child={child} />}
        {tab === 'settings' && <SettingsView child={child} onSelectChild={setChildId} />}
      </main>
      <nav className="tabbar no-print" aria-label="メインメニュー">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'active' : undefined} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function FirstRun({ onCreated, onDone }: { onCreated: (id: string) => void; onDone: () => void }) {
  const { dispatch } = useStore();

  function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = field(new FormData(e.currentTarget), 'name');
    if (!name) return;
    const id = newId();
    dispatch({ type: 'addChild', child: { id, name, school: '', grade: '' } });
    onCreated(id);
    onDone();
  }

  return (
    <main>
      <h1>デイ手帳（家庭用）</h1>
      <p>放課後等デイサービスの利用日、デイでの様子、お子さんのサポートブックを、ひとつにまとめます。</p>
      <ul>
        <li>ログインは不要です。</li>
        <li>
          データは<strong>この端末の中だけ</strong>に保存され、インターネット上のどこにも送られません。
        </li>
        <li>その代わり、端末をなくしたり機種変更したりすると消えるので、設定画面から時々バックアップを書き出してください。</li>
      </ul>
      <form onSubmit={start} className="card">
        <label htmlFor="first-name">お子さんの呼び名</label>
        <input id="first-name" name="name" type="text" maxLength={40} required placeholder="例: たろう" />
        <button type="submit">はじめる</button>
      </form>
    </main>
  );
}
