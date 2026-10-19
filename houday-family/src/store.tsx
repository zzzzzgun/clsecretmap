import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
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

/** 操作が済んだことを知らせる短いメッセージ（画面下に数秒だけ出す） */
function toastFor(action: Action): string | null {
  switch (action.type) {
    case 'addChild':
      return `${action.child.name}さんを追加しました`;
    case 'updateChild':
      return '保存しました';
    case 'addFacility':
      return `${action.name}を追加しました`;
    case 'setFacilityChildren':
      return '通っている子を保存しました';
    case 'updateFacilityTimes':
      return '時刻・営業日を保存しました';
    case 'setFacilityArchived':
      return action.archived ? '「通っていない」にしました' : '元に戻しました';
    case 'addCertificate':
      return '受給者証を登録しました';
    case 'removeCertificate':
      return '受給者証を削除しました';
    case 'addPlans':
      return action.plans.length > 0 ? `予定を${action.plans.length}件追加しました` : null;
    case 'setPlanStatus':
      return action.status === 'cancelled' ? 'お休みにしました' : '予定に戻しました';
    case 'updatePlanTimes':
      return '時刻を変更しました';
    case 'removePlan':
      return '予定を削除しました';
    case 'saveSupportBook':
      return 'サポートブックを保存しました';
    case 'addLog':
      return '様子を記録しました';
    case 'removeLog':
      return '記録を削除しました';
    default:
      return null;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [state, rawDispatch] = useReducer(reducer, undefined, emptyState);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const dispatch = useCallback<Dispatch<Action>>((action) => {
    rawDispatch(action);
    const text = toastFor(action);
    if (text) setToast({ text, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  const skipNextSave = useRef(true);

  useEffect(() => {
    loadState()
      .then((saved) => {
        if (saved) rawDispatch({ type: 'replaceAll', state: saved });
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

  return (
    <StoreContext.Provider value={{ state, dispatch, saveError }}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {toast && (
          <div key={toast.key} className="toast">
            ✓ {toast.text}
          </div>
        )}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider の外で useStore が呼ばれました');
  return store;
}
