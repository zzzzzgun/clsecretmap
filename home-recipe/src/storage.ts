import type { Recipe } from './model';

// データはこの端末のブラウザ（localStorage）だけに保存する
export const STORAGE_KEY = 'home-recipe:v1';

export interface SavedData {
  version: 1;
  recipes: Recipe[];
}

export type LoadResult = { ok: true; recipes: Recipe[] } | { ok: false; recipes: Recipe[] };

export function loadRecipes(storage: Storage | undefined = safeStorage()): LoadResult {
  if (!storage) return { ok: true, recipes: [] };
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { ok: true, recipes: [] };
  try {
    const data = JSON.parse(raw) as SavedData;
    if (!data || !Array.isArray(data.recipes)) throw new Error('invalid');
    return { ok: true, recipes: data.recipes };
  } catch {
    // 壊れていたら上書きで消してしまわないよう、別の場所に退避してから空で始める
    storage.setItem(`${STORAGE_KEY}:broken:${Date.now()}`, raw);
    return { ok: false, recipes: [] };
  }
}

export function saveRecipes(recipes: Recipe[], storage: Storage | undefined = safeStorage()): boolean {
  if (!storage) return false;
  try {
    const data: SavedData = { version: 1, recipes };
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const LAST_BACKUP_KEY = 'home-recipe:lastBackupAt';

/** 前回バックアップを保存した日時（ISO）。まだなら null */
export function loadLastBackupAt(storage: Storage | undefined = safeStorage()): string | null {
  try {
    return storage?.getItem(LAST_BACKUP_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveLastBackupAt(iso: string, storage: Storage | undefined = safeStorage()): void {
  try {
    storage?.setItem(LAST_BACKUP_KEY, iso);
  } catch {
    // 保存できなくてもバックアップ自体はできているので何もしない
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
