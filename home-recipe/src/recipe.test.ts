import { describe, expect, it } from 'vitest';
import { displayAmount, formatNumber, parseAmount } from './amount';
import { latestRating, RATING_OPTIONS, ratingOption, type Recipe } from './model';
import { backupFileName, buildBackup, daysSince, mergeRecipes, parseBackup } from './backup';
import { loadRecipes, saveRecipes, STORAGE_KEY } from './storage';
import { highlightParts, normalize, searchRecipes, sortHits } from './search';
import { reducer } from './store';

describe('parseAmount', () => {
  it.each([
    ['1', 1],
    ['1.5', 1.5],
    ['1/2', 0.5],
    ['1と1/2', 1.5],
    ['1 1/2', 1.5],
    ['２', 2],
    ['１／３', 1 / 3],
    ['½', 0.5],
    ['.5', 0.5],
  ])('%s → %d', (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected);
  });

  it('空は null、読めないもの・0 は undefined', () => {
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('たくさん')).toBeUndefined();
    expect(parseAmount('0')).toBeUndefined();
    expect(parseAmount('1/0')).toBeUndefined();
  });
});

describe('formatNumber', () => {
  it('分数で表す', () => {
    expect(formatNumber(1.5, 'fraction')).toEqual({ text: '1と1/2', approx: false });
    expect(formatNumber(0.25, 'fraction')).toEqual({ text: '1/4', approx: false });
    expect(formatNumber(2 / 3, 'fraction')).toEqual({ text: '2/3', approx: false });
    expect(formatNumber(3, 'fraction')).toEqual({ text: '3', approx: false });
    expect(formatNumber(0.9999999999, 'fraction')).toEqual({ text: '1', approx: false });
  });
  it('ぴったりの分数がないときは「約」', () => {
    expect(formatNumber(0.375, 'fraction')).toEqual({ text: '1/3', approx: true });
    expect(formatNumber(1.1, 'fraction')).toEqual({ text: '1.1', approx: false });
  });
  it('g や ml は小数で丸める', () => {
    expect(formatNumber(133.333, 'decimal')).toEqual({ text: '133', approx: true });
    expect(formatNumber(150, 'decimal')).toEqual({ text: '150', approx: false });
    expect(formatNumber(7.5, 'decimal')).toEqual({ text: '7.5', approx: false });
  });
});

describe('displayAmount（人数で量を変える）', () => {
  it('2人分 → 4人分で倍になる', () => {
    expect(displayAmount({ amount: 200, unit: 'g' }, 2, 4).text).toBe('400g');
    expect(displayAmount({ amount: 1.5, unit: '大さじ' }, 2, 4).text).toBe('大さじ3');
    expect(displayAmount({ amount: 1, unit: '個' }, 2, 3).text).toBe('1と1/2個');
  });
  it('割り切れないときは「約」がつく', () => {
    expect(displayAmount({ amount: 200, unit: 'g' }, 3, 2).text).toBe('約133g');
  });
  it('少々・適量は人数を変えてもそのまま', () => {
    expect(displayAmount({ amount: null, unit: '少々' }, 2, 6).text).toBe('少々');
  });
  it('小さじ3杯以上は大さじ、大さじ1杯未満は小さじに言い換える', () => {
    expect(displayAmount({ amount: 1, unit: '小さじ' }, 1, 3)).toEqual({ text: '小さじ3', hint: '＝大さじ1' });
    expect(displayAmount({ amount: 1, unit: '大さじ' }, 2, 1)).toEqual({ text: '大さじ1/2', hint: '＝小さじ1と1/2' });
    expect(displayAmount({ amount: 1, unit: '小さじ' }, 1, 1).hint).toBeUndefined();
  });
});

const recipe = (name: string, items: string[], extra: Partial<Recipe> = {}): Recipe => ({
  id: name,
  name,
  description: '',
  servings: 2,
  items: items.map((n, i) => ({ id: `${name}-${i}`, kind: 'ingredient', name: n, amount: 1, unit: '個' })),
  steps: [],
  ratings: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...extra,
});

describe('searchRecipes（部分一致）', () => {
  const list = [
    recipe('肉じゃが', ['じゃがいも', '玉ねぎ', '牛こま切れ肉']),
    recipe('ポテトサラダ', ['ジャガイモ', 'きゅうり', 'マヨネーズ']),
    recipe('親子丼', ['鶏もも肉', '卵', '玉ねぎ']),
  ];
  const names = (q: string, f: 'all' | 'name' | 'item' = 'all') => searchRecipes(list, q, f).map((h) => h.recipe.name);

  it('料理名の一部で探せる', () => {
    expect(names('じゃが', 'name')).toEqual(['肉じゃが']);
    expect(names('丼')).toEqual(['親子丼']);
  });
  it('材料の一部で探せる（ひらがな・カタカナを区別しない）', () => {
    expect(names('じゃがいも', 'item')).toEqual(['肉じゃが', 'ポテトサラダ']);
    expect(names('ネギ')).toEqual(['肉じゃが', '親子丼']);
  });
  it('スペース区切りはすべて含むもの', () => {
    expect(names('玉ねぎ 卵')).toEqual(['親子丼']);
  });
  it('空なら全部', () => {
    expect(names('')).toHaveLength(3);
  });
  it('一致した材料を返す', () => {
    expect(searchRecipes(list, '肉', 'all').find((h) => h.recipe.name === '肉じゃが')?.matchedItems).toEqual(['牛こま切れ肉']);
  });
  it('評価順に並べ替えられる', () => {
    const rated = [
      recipe('A', [], { ratings: [{ id: '1', date: '2026-01-01', value: 'ema', comment: '' }] }),
      recipe('B', [], { ratings: [{ id: '2', date: '2026-01-01', value: 'all', comment: '' }] }),
      recipe('C', []),
    ];
    expect(sortHits(searchRecipes(rated, '', 'all'), 'rating').map((h) => h.recipe.name)).toEqual(['B', 'A', 'C']);
  });
  it('一致したところをハイライトする', () => {
    expect(highlightParts('肉じゃが', 'ジャガ')).toEqual([
      { text: '肉', hit: false },
      { text: 'じゃが', hit: true },
    ]);
    expect(normalize('ＡＢＣ')).toBe('abc');
  });
});

describe('評価と削除', () => {
  it('選べる評価は4つ', () => {
    expect(RATING_OPTIONS.map((o) => o.label)).toEqual(['みんな食べた', 'えまたく2人とも食べた', 'えまだけ食べた', 'たくだけ食べた']);
  });
  it('以前の版で登録した評価も、元の名前で表示できる', () => {
    expect(ratingOption('split').label).toBe('好みが分かれた');
  });
  it('最新の評価は日付が新しいもの', () => {
    const r = recipe('x', [], {
      ratings: [
        { id: '1', date: '2026-03-01', value: 'all', comment: '' },
        { id: '2', date: '2026-02-01', value: 'taku', comment: '' },
      ],
    });
    expect(latestRating(r)?.id).toBe('1');
  });
  it('reducer で評価の追加・レシピの削除ができる', () => {
    let state = [recipe('a', []), recipe('b', [])];
    state = reducer(state, { type: 'addRating', id: 'a', rating: { date: '2026-01-02', value: 'both', comment: 'よし' } });
    expect(state[0].ratings).toHaveLength(1);
    state = reducer(state, { type: 'delete', id: 'a' });
    expect(state.map((r) => r.name)).toEqual(['b']);
  });
});

describe('storage', () => {
  class MemoryStorage {
    data = new Map<string, string>();
    get length() { return this.data.size; }
    clear() { this.data.clear(); }
    getItem(k: string) { return this.data.get(k) ?? null; }
    key(i: number) { return [...this.data.keys()][i] ?? null; }
    removeItem(k: string) { this.data.delete(k); }
    setItem(k: string, v: string) { this.data.set(k, v); }
  }
  it('保存して読み戻せる', () => {
    const s = new MemoryStorage() as unknown as Storage;
    saveRecipes([recipe('a', ['卵'])], s);
    expect(loadRecipes(s)).toEqual({ ok: true, recipes: [recipe('a', ['卵'])] });
  });
  it('壊れたデータは退避して空で始める', () => {
    const s = new MemoryStorage();
    s.setItem(STORAGE_KEY, '{oops');
    const result = loadRecipes(s as unknown as Storage);
    expect(result).toEqual({ ok: false, recipes: [] });
    expect([...s.data.keys()].some((k) => k.startsWith(`${STORAGE_KEY}:broken:`))).toBe(true);
  });
});

describe('backup', () => {
  const now = new Date('2026-11-21T03:00:00Z');
  const a = recipe('a', ['卵'], {
    updatedAt: '2026-01-01T00:00:00Z',
    ratings: [{ id: 'r1', date: '2026-01-01', value: 'all', comment: '' }],
  });

  it('保存したものをそのまま読み戻せる', () => {
    const text = JSON.stringify(buildBackup([a], now));
    const b = parseBackup(text);
    expect(b.recipes).toEqual([a]);
    expect(b.exportedAt).toBe(now.toISOString());
    expect(backupFileName(now)).toBe('recipe-backup-2026-11-21.json');
  });

  it('ほかのファイルや壊れたファイルは読み込まない', () => {
    expect(() => parseBackup('not json')).toThrow('ファイルを読み取れません');
    expect(() => parseBackup(JSON.stringify({ app: 'houday-family', version: 1 }))).toThrow('形式');
    const broken = buildBackup([a], now) as unknown as { recipes: Record<string, unknown>[] };
    broken.recipes[0] = { ...broken.recipes[0], items: [{ id: 'x', kind: 'meat', name: '卵', unit: '個', amount: 1 }] };
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('材料・調味料');
  });

  it('追加：新しいものは足し、同じレシピは新しい編集を残して評価を合わせる', () => {
    const edited = { ...a, name: 'a（改）', updatedAt: '2026-02-01T00:00:00Z', ratings: [{ id: 'r2', date: '2026-02-01', value: 'ema' as const, comment: '' }] };
    const b = recipe('b', []);
    const r = mergeRecipes([a], [edited, b]);
    expect(r).toMatchObject({ added: 1, updated: 1, unchanged: 0 });
    expect(r.recipes.map((x) => x.name)).toEqual(['a（改）', 'b']);
    expect(r.recipes[0].ratings.map((x) => x.id)).toEqual(['r1', 'r2']);
  });

  it('追加：古いバックアップでは今の編集を上書きしない', () => {
    const old = { ...a, name: '古い名前', updatedAt: '2025-12-01T00:00:00Z' };
    const r = mergeRecipes([a], [old]);
    expect(r).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect(r.recipes[0].name).toBe('a');
  });

  it('前回のバックアップからの日数', () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince('2026-10-21T03:00:00Z', now)).toBe(31);
  });
});
