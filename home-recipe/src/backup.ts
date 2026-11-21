import type { ItemKind, Rating, Recipe, RecipeItem } from './model';

// バックアップファイル（JSON）。機種変更やブラウザのデータが消えたとき、家族の端末に渡すときに使う。

const APP_TAG = 'home-recipe';
export const BACKUP_VERSION = 1;
export const BACKUP_REMINDER_DAYS = 30;

export interface BackupFile {
  app: typeof APP_TAG;
  version: number;
  exportedAt: string;
  recipes: Recipe[];
}

export function buildBackup(recipes: Recipe[], now: Date): BackupFile {
  return { app: APP_TAG, version: BACKUP_VERSION, exportedAt: now.toISOString(), recipes };
}

export function backupFileName(now: Date): string {
  const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
  return `recipe-backup-${stamp}.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const KINDS: ItemKind[] = ['ingredient', 'seasoning'];

class BackupError extends Error {}

function check(cond: unknown, what: string): asserts cond {
  if (!cond) throw new BackupError(`バックアップファイルの${what}が読み取れません。このアプリで保存したファイルか確かめてください。`);
}

function parseItem(v: unknown): RecipeItem {
  check(isObject(v), '材料・調味料');
  check(isString(v.id) && isString(v.name) && isString(v.unit) && KINDS.includes(v.kind as ItemKind), '材料・調味料');
  check(v.amount === null || (typeof v.amount === 'number' && Number.isFinite(v.amount) && v.amount > 0), '材料・調味料の量');
  return { id: v.id, kind: v.kind as ItemKind, name: v.name, unit: v.unit, amount: v.amount as number | null };
}

function parseRating(v: unknown): Rating {
  check(isObject(v), '評価');
  check(isString(v.id) && isString(v.value) && isString(v.date) && /^\d{4}-\d{2}-\d{2}$/.test(v.date), '評価');
  return { id: v.id, value: v.value as Rating['value'], date: v.date, comment: isString(v.comment) ? v.comment : '' };
}

function parseRecipe(v: unknown): Recipe {
  check(isObject(v), 'レシピ');
  check(isString(v.id) && isString(v.name) && v.name.trim() !== '', 'レシピ');
  check(Number.isInteger(v.servings) && (v.servings as number) >= 1, `「${v.name}」の人数`);
  check(Array.isArray(v.items) && Array.isArray(v.steps) && v.steps.every(isString) && Array.isArray(v.ratings), `「${v.name}」`);
  check(isString(v.createdAt) && isString(v.updatedAt), `「${v.name}」の日時`);
  return {
    id: v.id,
    name: v.name,
    description: isString(v.description) ? v.description : '',
    servings: v.servings as number,
    items: v.items.map(parseItem),
    steps: v.steps as string[],
    ratings: v.ratings.map(parseRating),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/** 読み込んだファイルの中身を確かめる。おかしなファイルで今のデータを壊さないため。 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('ファイルを読み取れません。このアプリで保存したバックアップファイル（.json）を選んでください。');
  }
  check(isObject(raw) && raw.app === APP_TAG, '形式');
  check(raw.version === BACKUP_VERSION, 'バージョン');
  check(isString(raw.exportedAt), '日時');
  check(Array.isArray(raw.recipes), 'レシピ');
  const recipes = raw.recipes.map(parseRecipe);
  check(new Set(recipes.map((r) => r.id)).size === recipes.length, 'レシピ（重複）');
  return { app: APP_TAG, version: BACKUP_VERSION, exportedAt: raw.exportedAt, recipes };
}

export interface MergeResult {
  recipes: Recipe[];
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * 今のレシピにバックアップを足す。
 * 同じレシピ（同じ id）は更新日時が新しいほうを残し、評価は両方を合わせる。
 * 家族の端末どうしで行き来させても、消えるものがないようにするため。
 */
export function mergeRecipes(current: Recipe[], incoming: Recipe[]): MergeResult {
  const result = [...current];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const inc of incoming) {
    const idx = result.findIndex((r) => r.id === inc.id);
    if (idx === -1) {
      result.push(inc);
      added++;
      continue;
    }
    const cur = result[idx];
    const base = inc.updatedAt > cur.updatedAt ? inc : cur;
    const ids = new Set(cur.ratings.map((r) => r.id));
    const ratings = [...cur.ratings, ...inc.ratings.filter((r) => !ids.has(r.id))];
    const merged = { ...base, ratings };
    if (JSON.stringify(merged) === JSON.stringify(cur)) unchanged++;
    else {
      result[idx] = merged;
      updated++;
    }
  }
  return { recipes: result, added, updated, unchanged };
}

export function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}
