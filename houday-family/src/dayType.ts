import { weekdayIndex, type IsoDate } from '@domain/dates';
import { holidayName } from '@domain/holidays';
import type { Child, Facility, PickupFrom, PlanEntry } from './model';

// 平日（学校がある日）は学校からデイへ、土日・祝日・学校が休みの期間は家からデイへ行く。
// それぞれでお迎えの場所と時刻が違うので、日付から自動で決める。

export type DayKind =
  | { kind: 'school'; periods: number | null }
  | { kind: 'home'; reason: 'weekend' | 'holiday' | 'break'; label: string };

export function schoolBreakOn(child: Child, date: IsoDate) {
  return (child.schoolBreaks ?? []).find((b) => b.from <= date && date <= b.until) ?? null;
}

export function dayKind(child: Child, date: IsoDate): DayKind {
  const weekday = weekdayIndex(date);
  if (weekday === 0 || weekday === 6) return { kind: 'home', reason: 'weekend', label: weekday === 0 ? '日曜日' : '土曜日' };
  const holiday = holidayName(date);
  if (holiday) return { kind: 'home', reason: 'holiday', label: holiday };
  const schoolBreak = schoolBreakOn(child, date);
  if (schoolBreak) return { kind: 'home', reason: 'break', label: schoolBreak.label };
  return { kind: 'school', periods: child.weeklyPeriods?.[String(weekday)] ?? null };
}

export function dismissalTime(child: Child, periods: number | null | undefined): string | null {
  if (periods == null) return null;
  return child.dismissal?.[String(periods)] || null;
}

export interface PlanTimes {
  pickupFrom: PickupFrom;
  periods: number | null;
  pickupTime: string | null;
  returnTime: string | null;
}

/** その日・そのデイの、ふだんどおりのお迎え・帰宅（入力の初期値に使う） */
export function defaultPlanTimes(child: Child, facility: Facility | undefined, date: IsoDate): PlanTimes {
  const day = dayKind(child, date);
  if (day.kind === 'school') {
    return {
      pickupFrom: 'school',
      periods: day.periods,
      pickupTime: dismissalTime(child, day.periods),
      returnTime: facility?.weekdayReturn || null,
    };
  }
  return {
    pickupFrom: 'home',
    periods: null,
    pickupTime: facility?.homePickup || null,
    returnTime: facility?.homeReturn || null,
  };
}

/** 古いデータ（pickupFrom がない）は日付から判断する */
export function pickupFromOf(child: Child, plan: Pick<PlanEntry, 'date' | 'pickupFrom'>): PickupFrom {
  return plan.pickupFrom ?? dayKind(child, plan.date).kind;
}

const short = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

/** 「学校お迎え 15:20（6時間）・帰宅 17:30」「家お迎え 9:30・帰宅 16:00」 */
export function planTimesText(child: Child, plan: Pick<PlanEntry, 'date' | 'pickupFrom' | 'periods' | 'pickupTime' | 'returnTime'>): string {
  const from = pickupFromOf(child, plan);
  const pickup = short(plan.pickupTime);
  const parts = [
    `${from === 'school' ? '学校' : '自宅'}お迎え${pickup ? ` ${pickup}` : ''}${from === 'school' && plan.periods ? `（${plan.periods}時間）` : ''}`,
    short(plan.returnTime) && `帰宅 ${short(plan.returnTime)}`,
  ];
  return parts.filter(Boolean).join('・');
}

/** お迎えの場所（と授業の時間数）を指定したときの時刻 */
export function timesFor(
  child: Child,
  facility: Facility | undefined,
  date: IsoDate,
  pickupFrom: PickupFrom,
  periods?: number | null,
): PlanTimes {
  if (pickupFrom === 'school') {
    const day = dayKind(child, date);
    const p = periods !== undefined ? periods : day.kind === 'school' ? day.periods : null;
    return { pickupFrom, periods: p, pickupTime: dismissalTime(child, p), returnTime: facility?.weekdayReturn || null };
  }
  return { pickupFrom, periods: null, pickupTime: facility?.homePickup || null, returnTime: facility?.homeReturn || null };
}

/** 「土曜日なので家から」のような、その日の扱いの説明 */
export function dayKindNote(child: Child, date: IsoDate): string {
  const day = dayKind(child, date);
  if (day.kind === 'school') {
    return day.periods ? `学校がある日（ふだんは${day.periods}時間授業）` : '学校がある日';
  }
  if (day.reason === 'holiday') return `祝日（${day.label}）なので家から`;
  if (day.reason === 'break') return `${day.label}なので家から`;
  return `${day.label}なので家から`;
}
