// 日付は 'YYYY-MM-DD' の文字列で扱う（タイムゾーンのずれを避けるため Date に変換しない）

export type IsoDate = string;
export type IsoMonth = string;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function todayInTokyo(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function isIsoMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function addMonths(month: IsoMonth, months: number): IsoMonth {
  const d = toUtc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return fromUtc(d).slice(0, 7);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function datesInMonth(month: IsoMonth): IsoDate[] {
  const first = `${month}-01`;
  const dates: IsoDate[] = [];
  for (let d = first; monthOf(d) === month; d = addDays(d, 1)) {
    dates.push(d);
  }
  return dates;
}

export function lastDayOfMonth(month: IsoMonth): IsoDate {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

/** 0 = 日曜 */
export function weekdayIndex(date: IsoDate): number {
  return toUtc(date).getUTCDay();
}

export function weekdayLabel(date: IsoDate): string {
  return WEEKDAYS[weekdayIndex(date)];
}

/** その日を含む週の月曜日 */
export function mondayOf(date: IsoDate): IsoDate {
  const offset = (weekdayIndex(date) + 6) % 7;
  return addDays(date, -offset);
}

export function formatJapaneseDate(date: IsoDate): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}(${weekdayLabel(date)})`;
}
