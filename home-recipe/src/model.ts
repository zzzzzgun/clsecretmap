export type ItemKind = 'ingredient' | 'seasoning';

export const KIND_LABEL: Record<ItemKind, string> = {
  ingredient: '材料',
  seasoning: '調味料',
};

export interface RecipeItem {
  id: string;
  kind: ItemKind;
  name: string;
  /** 量。単位が「少々」「適量」など量を持たないものは null */
  amount: number | null;
  unit: string;
}

export type RatingValue = 'all' | 'most' | 'split' | 'left';

export interface Rating {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  value: RatingValue;
  comment: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  /** このレシピの分量が何人分か */
  servings: number;
  items: RecipeItem[];
  steps: string[];
  ratings: Rating[];
  createdAt: string;
  updatedAt: string;
}

// ---- 単位 ----

/** before: 大さじ1 / after: 200g / none: 少々（量を持たない） */
export type UnitPosition = 'before' | 'after' | 'none';
/** fraction: 1と1/2 のように分数で表示 / decimal: 133g のように小数で表示 */
export type UnitStyle = 'fraction' | 'decimal';

export interface UnitDef {
  value: string;
  position: UnitPosition;
  style: UnitStyle;
}

export const UNIT_GROUPS: { label: string; units: UnitDef[] }[] = [
  {
    label: 'さじ・カップ',
    units: [
      { value: '大さじ', position: 'before', style: 'fraction' },
      { value: '小さじ', position: 'before', style: 'fraction' },
      { value: 'カップ', position: 'after', style: 'fraction' },
    ],
  },
  {
    label: '重さ・かさ',
    units: [
      { value: 'g', position: 'after', style: 'decimal' },
      { value: 'kg', position: 'after', style: 'decimal' },
      { value: 'ml', position: 'after', style: 'decimal' },
      { value: 'L', position: 'after', style: 'decimal' },
      { value: 'cc', position: 'after', style: 'decimal' },
    ],
  },
  {
    label: '数',
    units: ['個', '本', '枚', '玉', '片', 'かけ', '束', '株', '房', '袋', 'パック', '缶', '箱', '切れ', '尾', '丁', '合', '杯'].map(
      (value): UnitDef => ({ value, position: 'after', style: 'fraction' }),
    ),
  },
  {
    label: '目安（量なし）',
    units: ['少々', '適量', 'ひとつまみ', 'お好みで'].map((value): UnitDef => ({ value, position: 'none', style: 'fraction' })),
  },
];

const UNIT_MAP = new Map(UNIT_GROUPS.flatMap((g) => g.units).map((u) => [u.value, u]));

export function unitDef(unit: string): UnitDef {
  return UNIT_MAP.get(unit) ?? { value: unit, position: 'after', style: 'fraction' };
}

export function hasAmount(unit: string): boolean {
  return unitDef(unit).position !== 'none';
}

/** 量の入力欄に出す候補 */
export function amountSuggestions(unit: string): string[] {
  const u = unitDef(unit);
  if (u.position === 'none') return [];
  if (u.style === 'decimal') {
    if (u.value === 'kg' || u.value === 'L') return ['0.5', '1', '1.5', '2'];
    return ['10', '50', '100', '150', '200', '250', '300', '400', '500'];
  }
  return ['1/4', '1/3', '1/2', '2/3', '1', '1と1/2', '2', '3', '4'];
}

// ---- 材料・調味料の候補 ----

export interface Preset {
  name: string;
  unit: string;
}

const p = (unit: string, names: string): Preset[] => names.split(' ').map((name) => ({ name, unit }));

export const PRESETS: Record<ItemKind, { label: string; items: Preset[] }[]> = {
  ingredient: [
    {
      label: '肉・加工品',
      items: [
        ...p('g', '豚こま切れ肉 豚バラ肉 豚ロース肉 豚ひき肉 鶏もも肉 鶏むね肉 鶏ささみ 鶏ひき肉 合いびき肉 牛こま切れ肉'),
        ...p('枚', 'ベーコン ハム'),
        ...p('本', 'ウインナー'),
      ],
    },
    {
      label: '魚介',
      items: [...p('切れ', '鮭 さば ぶり たら'), ...p('g', 'えび いか あさり'), ...p('缶', 'ツナ缶'), ...p('本', 'ちくわ')],
    },
    {
      label: '野菜・きのこ',
      items: [
        ...p('個', '玉ねぎ じゃがいも トマト ピーマン'),
        ...p('本', 'にんじん なす きゅうり 長ねぎ ごぼう さつまいも'),
        ...p('枚', 'キャベツ 白菜'),
        ...p('g', '大根 かぼちゃ れんこん'),
        ...p('束', 'ほうれん草 小松菜 にら'),
        ...p('袋', 'もやし'),
        ...p('株', 'ブロッコリー'),
        ...p('パック', 'しめじ えのき まいたけ'),
        ...p('枚', 'しいたけ'),
        ...p('片', 'にんにく'),
        ...p('かけ', 'しょうが'),
      ],
    },
    {
      label: '卵・乳製品・大豆',
      items: [
        ...p('個', '卵'),
        ...p('ml', '牛乳 生クリーム'),
        ...p('g', 'バター ピザ用チーズ'),
        ...p('丁', '豆腐'),
        ...p('枚', '油揚げ'),
        ...p('パック', '納豆'),
      ],
    },
    {
      label: '主食・粉・その他',
      items: [
        ...p('合', '米'),
        ...p('g', 'ごはん スパゲッティ 小麦粉'),
        ...p('玉', 'うどん 中華麺'),
        ...p('枚', '食パン'),
        ...p('大さじ', '片栗粉 パン粉'),
        ...p('ml', '水'),
        ...p('袋', 'しらたき'),
        ...p('枚', 'こんにゃく'),
        ...p('g', '乾燥わかめ'),
      ],
    },
  ],
  seasoning: [
    {
      label: '基本',
      items: [...p('大さじ', '砂糖 しょうゆ みそ 酒 みりん 酢'), ...p('少々', '塩 こしょう 塩こしょう')],
    },
    { label: '油', items: p('大さじ', 'サラダ油 ごま油 オリーブオイル') },
    {
      label: 'だし・スープの素',
      items: [...p('小さじ', '顆粒だし 鶏がらスープの素'), ...p('個', 'コンソメ'), ...p('大さじ', 'めんつゆ 白だし')],
    },
    {
      label: 'ソース・たれ',
      items: p('大さじ', 'ケチャップ マヨネーズ ウスターソース 中濃ソース オイスターソース ポン酢 焼肉のたれ'),
    },
    {
      label: '香辛料・その他',
      items: [
        ...p('小さじ', '豆板醤 コチュジャン おろしにんにく おろししょうが はちみつ'),
        ...p('大さじ', '白ごま'),
        ...p('少々', '一味唐辛子'),
        ...p('箱', 'カレールウ'),
      ],
    },
  ],
};

// ---- 評価 ----

export const RATING_OPTIONS: { value: RatingValue; emoji: string; label: string; score: number }[] = [
  { value: 'all', emoji: '😋', label: '全員おいしく食べた', score: 4 },
  { value: 'most', emoji: '🙂', label: 'だいたい好評だった', score: 3 },
  { value: 'split', emoji: '😐', label: '好みが分かれた', score: 2 },
  { value: 'left', emoji: '😣', label: '残す人が多かった', score: 1 },
];

export function ratingOption(value: RatingValue) {
  return RATING_OPTIONS.find((o) => o.value === value) ?? RATING_OPTIONS[0];
}

/** 最新の評価（日付が新しいもの、同じ日なら後から登録したもの） */
export function latestRating(recipe: Recipe): Rating | undefined {
  return sortedRatings(recipe)[0];
}

export function sortedRatings(recipe: Recipe): Rating[] {
  return recipe.ratings
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.date === b.r.date ? b.i - a.i : a.r.date < b.r.date ? 1 : -1))
    .map((x) => x.r);
}

/** 評価の平均点（1〜4）。評価がなければ 0 */
export function averageScore(recipe: Recipe): number {
  if (recipe.ratings.length === 0) return 0;
  return recipe.ratings.reduce((sum, r) => sum + ratingOption(r.value).score, 0) / recipe.ratings.length;
}

export const SERVING_CHOICES = Array.from({ length: 10 }, (_, i) => i + 1);

export function newId(): string {
  // crypto.randomUUID は https / localhost でしか使えないので、同じ Wi-Fi のスマホから http で開いたとき用の予備を持つ
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
