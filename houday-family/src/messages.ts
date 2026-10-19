import { monthOf, weekdayIndex, type IsoMonth } from '@domain/dates';
import { formatDateWithHoliday, holidayName } from '@domain/holidays';
import { shortTime, type SchoolDay } from '@domain/schedule';
import type { PlanEntry } from './model';

function monthLabel(month: IsoMonth): string {
  return `${Number(month.slice(5))}月`;
}

function timesText(p: Pick<PlanEntry, 'pickupTime' | 'returnTime'>): string {
  return [
    shortTime(p.pickupTime) && `迎え ${shortTime(p.pickupTime)}`,
    shortTime(p.returnTime) && `帰宅 ${shortTime(p.returnTime)}`,
  ]
    .filter(Boolean)
    .join('・');
}

/** デイに送る「来月の利用希望日」の文面（LINE やメールに貼る） */
export function requestMessage(args: {
  childName: string;
  facilityName: string;
  month: IsoMonth;
  plans: readonly PlanEntry[];
}): string {
  const dates = args.plans
    .filter((p) => p.status === 'planned' && monthOf(p.date) === args.month)
    .sort((a, b) => a.date.localeCompare(b.date));

  const lines = dates.map((p) => {
    const times = timesText(p);
    return `・${formatDateWithHoliday(p.date)}${times ? ` ${times}` : ''}`;
  });

  return [
    `${args.facilityName} ご担当者様`,
    '',
    `いつもお世話になっております。${args.childName}の${monthLabel(args.month)}の利用希望日をお送りします。`,
    '',
    ...(lines.length > 0 ? lines : ['（この月の希望日はありません）']),
    '',
    `計${dates.length}日です。よろしくお願いいたします。`,
  ].join('\n');
}

/** 学校（連絡帳・担任の先生）に伝える、週のデイの予定 */
export function schoolWeekMessage(args: { childName: string; days: readonly SchoolDay[]; skipWeekends?: boolean }): string {
  const days = args.skipWeekends === false ? args.days : args.days.filter((d) => !isWeekend(d.date));
  const lines = days.map((d) => {
    const label = formatDateWithHoliday(d.date);
    const holiday = holidayName(d.date);
    const visits = d.visits.map((v) => `${v.facilityName}${v.pickupTime ? `（迎え ${shortTime(v.pickupTime)}）` : ''}`);
    // 祝日は学校が休みなので、学校からの迎えはない。デイに行く場合だけ書き添える
    if (holiday) return `${label} ${[holiday, ...visits].join('・')}`;
    if (visits.length === 0) return `${label} デイなし`;
    return `${label} ${visits.join('、')}`;
  });
  return [`${args.childName}のデイの予定です。`, '', ...lines, '', 'よろしくお願いいたします。'].join('\n');
}

function isWeekend(date: string): boolean {
  const day = weekdayIndex(date);
  return day === 0 || day === 6;
}
