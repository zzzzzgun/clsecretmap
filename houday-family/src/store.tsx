import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { emptyState, type AppState } from './model';
import { reducer, type Action } from './reducer';
import { loadState, requestPersistence, saveState } from './storage';

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** 端末への保存に失敗した（容量不足・プライベートブラウズなど） */
  saveError: string | null;
}

const StoreContext = createContext<Store | null>(null);

export function newId(): string {
  return crypto.randomUUID();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const skipNextSave = useRef(true);

  useEffect(() => {
    loadState()
      .then((saved) => {
        if (saved) dispatch({ type: 'replaceAll', state: saved });
        setLoaded(true);
        void requestPersistence();
      })
      .catch(() => setLoadError('この端末にデータを保存できません。プライベートブラウズを使っている場合は、通常のモードで開いてください。'));
  }, []);

  // 変更のたびに端末へ保存する（読み込み直後の1回は保存しない）
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveState(state)
      .then(() => setSaveError(null))
      .catch(() => setSaveError('保存できませんでした。端末の空き容量を確かめてください。'));
  }, [state, loaded]);

  if (loadError) return <main><p className="notice danger">{loadError}</p></main>;
  if (!loaded) return <main><p className="muted">読み込み中…</p></main>;

  return <StoreContext.Provider value={{ state, dispatch, saveError }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider の外で useStore が呼ばれました');
  return store;
}
