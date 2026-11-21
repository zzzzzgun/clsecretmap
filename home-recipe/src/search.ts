import { averageScore, type Recipe } from './model';

export type SearchField = 'all' | 'name' | 'item';
export type SortKey = 'updated' | 'name' | 'rating';

/** 大文字小文字・全角半角・ひらがなカタカナの違いを無視して比べるための正規化 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function splitTerms(query: string): string[] {
  return normalize(query)
    .split(/[\s　]+/)
    .filter(Boolean);
}

export interface SearchHit {
  recipe: Recipe;
  /** 検索語に一致した材料・調味料の名前 */
  matchedItems: string[];
}

/**
 * 部分一致で探す。スペースで区切った語はすべて含むもの（AND）。
 * 1つの語は、料理名か材料・調味料のどれかに含まれていればよい。
 */
export function searchRecipes(recipes: Recipe[], query: string, field: SearchField): SearchHit[] {
  const terms = splitTerms(query);
  const hits: SearchHit[] = [];
  for (const recipe of recipes) {
    const name = normalize(recipe.name);
    const items = recipe.items.map((i) => ({ raw: i.name, norm: normalize(i.name) }));
    const matched = new Set<string>();
    const all = terms.every((t) => {
      const inName = field !== 'item' && name.includes(t);
      const itemHits = field !== 'name' ? items.filter((i) => i.norm.includes(t)) : [];
      itemHits.forEach((i) => matched.add(i.raw));
      return inName || itemHits.length > 0;
    });
    if (all) hits.push({ recipe, matchedItems: [...matched] });
  }
  return hits;
}

export function sortHits(hits: SearchHit[], key: SortKey): SearchHit[] {
  const copy = [...hits];
  if (key === 'name') copy.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, 'ja'));
  else if (key === 'rating')
    copy.sort((a, b) => averageScore(b.recipe) - averageScore(a.recipe) || byUpdated(a.recipe, b.recipe));
  else copy.sort((a, b) => byUpdated(a.recipe, b.recipe));
  return copy;
}

function byUpdated(a: Recipe, b: Recipe): number {
  return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
}

/** 料理名の中で検索語に一致した部分を切り出す（ハイライト用） */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = splitTerms(query);
  if (terms.length === 0) return [{ text, hit: false }];
  // 正規化しても1文字ずつの対応は崩れない文字がほとんどなので、文字単位で印をつける
  const chars = [...text];
  const normChars = chars.map((c) => normalize(c));
  if (normChars.some((c) => [...c].length !== 1)) return [{ text, hit: false }];
  const norm = normChars.join('');
  const marks = new Array<boolean>(chars.length).fill(false);
  for (const t of terms) {
    let from = 0;
    let idx: number;
    while ((idx = norm.indexOf(t, from)) !== -1) {
      for (let i = idx; i < idx + [...t].length; i++) marks[i] = true;
      from = idx + 1;
    }
  }
  const parts: { text: string; hit: boolean }[] = [];
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === marks[i]) last.text += c;
    else parts.push({ text: c, hit: marks[i] });
  });
  return parts;
}
