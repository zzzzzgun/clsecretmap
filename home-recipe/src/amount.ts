import { unitDef, type RecipeItem } from './model';

/**
 * 入力された量を数値にする。
 * 「1」「1.5」「1/2」「1と1/2」「1 1/2」「½」、全角数字に対応。
 * 空なら null、読めない・0 以下なら undefined。
 */
export function parseAmount(raw: string): number | null | undefined {
  const s = raw
    .normalize('NFKC') // 全角 → 半角、½ → 1⁄2
    .replace(/⁄/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  if (s === '') return null;

  let value: number | undefined;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+(?:\.\d+)?|\.\d+)$/))) {
    value = Number(m[1]);
  } else if ((m = s.match(/^(\d+)\/(\d+)$/))) {
    value = Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : undefined;
  } else if ((m = s.match(/^(\d+) ?(?:と|・| )? ?(\d+)\/(\d+)$/))) {
    value = Number(m[3]) > 0 ? Number(m[1]) + Number(m[2]) / Number(m[3]) : undefined;
  }
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

/** 編集欄に戻すときの文字列（分数で入れたものは分数で戻す） */
export function amountToInput(amount: number | null, unit: string): string {
  if (amount === null) return '';
  return formatNumber(amount, unitDef(unit).style).text;
}

const DENOMINATORS = [2, 3, 4];

/**
 * 数を料理らしく表示する。
 * fraction: 1.5 → 「1と1/2」、0.375 → 「約1/3」
 * decimal : 133.33 → 「約133」、7.5 → 「7.5」
 */
export function formatNumber(n: number, style: 'fraction' | 'decimal'): { text: string; approx: boolean } {
  if (style === 'decimal') {
    const digits = n >= 10 ? 0 : n >= 1 ? 1 : 2;
    const rounded = round(n, digits);
    return { text: trimZeros(rounded.toFixed(digits)), approx: !nearlyEqual(rounded, n) };
  }

  let whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  let best = { num: 0, den: 1, err: frac };
  for (const den of DENOMINATORS) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num / den);
    if (err < best.err - 1e-9) best = { num, den, err };
  }
  if (Math.abs(1 - frac) < best.err - 1e-9) best = { num: 1, den: 1, err: Math.abs(1 - frac) };

  if (best.err > 0.05 || (whole === 0 && best.num === 0)) {
    // 分数にすると大きくずれるときは小数で
    const digits = n >= 10 ? 0 : 1;
    const rounded = Math.max(round(n, digits), digits === 0 ? 1 : 0.1);
    return { text: trimZeros(rounded.toFixed(digits)), approx: !nearlyEqual(rounded, n) };
  }

  let num = best.num;
  const den = best.den;
  if (num === den) {
    whole += 1;
    num = 0;
  }
  const approx = best.err > 1e-6;
  const fracText = num > 0 ? `${num}/${den}` : '';
  const text = whole > 0 && fracText ? `${whole}と${fracText}` : whole > 0 ? String(whole) : fracText;
  return { text, approx };
}

/** 人数に合わせて量を変える */
export function scaleAmount(amount: number, baseServings: number, servings: number): number {
  return (amount * servings) / baseServings;
}

export interface DisplayAmount {
  /** 「大さじ1と1/2」「約133g」「少々」 */
  text: string;
  /** 小さじ⇔大さじの言い換え（「＝大さじ1」など）。ないときは undefined */
  hint?: string;
}

export function displayAmount(item: Pick<RecipeItem, 'amount' | 'unit'>, baseServings: number, servings: number): DisplayAmount {
  const u = unitDef(item.unit);
  if (u.position === 'none' || item.amount === null) return { text: item.unit };
  const n = scaleAmount(item.amount, baseServings, servings);
  return { text: withUnit(n, item.unit), hint: spoonHint(n, item.unit) };
}

function withUnit(n: number, unit: string): string {
  const u = unitDef(unit);
  const { text, approx } = formatNumber(n, u.style);
  const prefix = approx ? '約' : '';
  return u.position === 'before' ? `${unit}${prefix}${text}` : `${prefix}${text}${unit}`;
}

/** 小さじ3杯以上は大さじに、大さじ1杯未満は小さじに言い換える（きれいに割り切れるときだけ） */
function spoonHint(n: number, unit: string): string | undefined {
  let other: { n: number; unit: string } | undefined;
  if (unit === '小さじ' && n >= 3 - 1e-9) other = { n: n / 3, unit: '大さじ' };
  if (unit === '大さじ' && n < 1 - 1e-9) other = { n: n * 3, unit: '小さじ' };
  if (!other) return undefined;
  if (formatNumber(n, 'fraction').approx || formatNumber(other.n, 'fraction').approx) return undefined;
  return `＝${withUnit(other.n, other.unit)}`;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
