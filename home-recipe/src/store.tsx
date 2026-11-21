import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { newId, type Rating, type Recipe } from './model';
import { loadRecipes, saveRecipes } from './storage';

type Action =
  | { type: 'save'; recipe: Recipe }
  | { type: 'delete'; id: string }
  | { type: 'addRating'; id: string; rating: Omit<Rating, 'id'> }
  | { type: 'deleteRating'; id: string; ratingId: string }
  | { type: 'addMany'; recipes: Recipe[] };

export function reducer(recipes: Recipe[], action: Action): Recipe[] {
  switch (action.type) {
    case 'save': {
      const exists = recipes.some((r) => r.id === action.recipe.id);
      return exists ? recipes.map((r) => (r.id === action.recipe.id ? action.recipe : r)) : [...recipes, action.recipe];
    }
    case 'delete':
      return recipes.filter((r) => r.id !== action.id);
    case 'addRating':
      return recipes.map((r) => (r.id === action.id ? { ...r, ratings: [...r.ratings, { ...action.rating, id: newId() }] } : r));
    case 'deleteRating':
      return recipes.map((r) => (r.id === action.id ? { ...r, ratings: r.ratings.filter((x) => x.id !== action.ratingId) } : r));
    case 'addMany':
      return [...recipes, ...action.recipes];
  }
}

interface Store {
  recipes: Recipe[];
  dispatch: (action: Action) => void;
  /** 読み込み・保存に失敗したときの注意書き */
  storageWarning: string | null;
  toast: (message: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadRecipes(), []);
  const [recipes, dispatch] = useReducer(reducer, initial.recipes);
  const [storageWarning, setStorageWarning] = useState<string | null>(
    initial.ok ? null : '保存されていたデータを読み込めませんでした（元のデータは端末内に退避してあります）。',
  );
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!saveRecipes(recipes)) setStorageWarning('この端末に保存できませんでした。プライベートブラウズでは保存されないことがあります。');
  }, [recipes]);

  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const value = useMemo(() => ({ recipes, dispatch, storageWarning, toast }), [recipes, storageWarning, toast]);
  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="toast-area" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.message}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider の外で使われています');
  return s;
}
