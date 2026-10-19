import { addDays, datesInMonth, formatJapaneseDate, weekdayIndex, type IsoDate, type IsoMonth } from './dates';

// 日本の祝日（国民の祝日に関する法律）を計算する。2022年〜2099年に対応。
// 春分の日・秋分の日は毎年2月に国立天文台の発表で正式に決まるため、ここでは一般に使われる近似式で求める
// （2099年までは発表と一致するとされる）。法律が変わったらここを直す。

export interface Holiday {
  date: IsoDate;
  name: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** その月の第n月曜日 */
function nthMonday(year: number, month: number, n: number): IsoDate {
  const first = ymd(year, month, 1);
  const offset = (8 - weekdayIndex(first)) % 7; // 最初の月曜日までの日数
  return addDays(first, offset + 7 * (n - 1));
}

function vernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

const cache = new Map<number, Map<IsoDate, string>>();

function holidaysOfYear(year: number): Map<IsoDate, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const base: Holiday[] = [
    { date: ymd(year, 1, 1), name: '元日' },
    { date: nthMonday(year, 1, 2), name: '成人の日' },
    { date: ymd(year, 2, 11), name: '建国記念の日' },
    { date: ymd(year, 2, 23), name: '天皇誕生日' },
    { date: ymd(year, 3, vernalEquinoxDay(year)), name: '春分の日' },
    { date: ymd(year, 4, 29), name: '昭和の日' },
    { date: ymd(year, 5, 3), name: '憲法記念日' },
    { date: ymd(year, 5, 4), name: 'みどりの日' },
    { date: ymd(year, 5, 5), name: 'こどもの日' },
    { date: nthMonday(year, 7, 3), name: '海の日' },
    { date: ymd(year, 8, 11), name: '山の日' },
    { date: nthMonday(year, 9, 3), name: '敬老の日' },
    { date: ymd(year, 9, autumnalEquinoxDay(year)), name: '秋分の日' },
    { date: nthMonday(year, 10, 2), name: 'スポーツの日' },
    { date: ymd(year, 11, 3), name: '文化の日' },
    { date: ymd(year, 11, 23), name: '勤労感謝の日' },
  ];

  const result = new Map(base.map((h) => [h.date, h.name]));

  // 国民の休日: 前日と翌日が祝日の平日（例: 敬老の日と秋分の日に挟まれた日）
  for (const h of base) {
    const next = addDays(h.date, 1);
    if (!result.has(next) && result.has(addDays(h.date, 2)) && weekdayIndex(next) !== 0) {
      result.set(next, '国民の休日');
    }
  }

  // 振替休日: 祝日が日曜日なら、その後の最初の「祝日でない日」が休日
  for (const h of base) {
    if (weekdayIndex(h.date) !== 0) continue;
    let d = addDays(h.date, 1);
    while (result.has(d)) d = addDays(d, 1);
    result.set(d, '振替休日');
  }

  cache.set(year, result);
  return result;
}

/** 祝日ならその名前、そうでなければ null */
export function holidayName(date: IsoDate): string | null {
  const year = Number(date.slice(0, 4));
  return holidaysOfYear(year).get(date) ?? null;
}

export function isHoliday(date: IsoDate): boolean {
  return holidayName(date) !== null;
}

/** その月の祝日（日付順） */
export function holidaysInMonth(month: IsoMonth): Holiday[] {
  return datesInMonth(month)
    .map((date) => ({ date, name: holidayName(date) }))
    .filter((h): h is Holiday => h.name !== null);
}

/** '10/12(月・祝)' のように、祝日なら「祝」を付けた短い日付 */
export function formatDateWithHoliday(date: IsoDate): string {
  const label = formatJapaneseDate(date);
  return isHoliday(date) ? label.replace(')', '・祝)') : label;
}
