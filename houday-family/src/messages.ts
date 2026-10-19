import { monthOf, weekdayIndex, type IsoMonth } from '@domain/dates';
import { formatDateWithHoliday } from '@domain/holidays';
import { shortTime, type SchoolDay } from '@domain/schedule';
import { dayKind, planTimesText } from './dayType';
import type { Child, PlanEntry } from './model';

function monthLabel(month: IsoMonth): string {
  return `${Number(month.slice(5))}月`;
}

/** デイに送る「来月の利用希望日」の文面（LINE やメールに貼る） */
export function requestMessage(args: {
  child: Child;
  facilityName: string;
  month: IsoMonth;
  plans: readonly PlanEntry[];
}): string {
  const dates = args.plans
    .filter((p) => p.status === 'planned' && monthOf(p.date) === args.month)
    .sort((a, b) => a.date.localeCompare(b.date));

  const lines = dates.map((p) => `・${formatDateWithHoliday(p.date)} ${planTimesText(args.child, p)}`);

  return [
    `${args.facilityName} ご担当者様`,
    '',
    `いつもお世話になっております。${args.child.name}の${monthLabel(args.month)}の利用希望日をお送りします。`,
    '',
    ...(lines.length > 0 ? lines : ['（この月の希望日はありません）']),
    '',
    `計${dates.length}日です。よろしくお願いいたします。`,
  ].join('\n');
}

export interface SchoolDayLine {
  dateLabel: string;
  /** 学校が休みの日の理由（祝日名・「冬休み」など）。学校がある日は null */
  noSchool: string | null;
  /** その日のデイ。学校がある日は下校後のお迎え時刻つき */
  visits: string;
}

/** 学校向けの表・文面の1日分 */
export function schoolDayLine(child: Child, d: SchoolDay): SchoolDayLine {
  const day = dayKind(child, d.date);
  const noSchool = day.kind === 'home' ? day.label : null;
  const visits = d.visits
    .map((v) =>
      // 学校が休みの日は家から行くので、学校向けにはお迎え時刻を書かない
      noSchool ? `${v.facilityName}（家から）` : `${v.facilityName}${v.pickupTime ? `（迎え ${shortTime(v.pickupTime)}）` : ''}`,
    )
    .join('、');
  return { dateLabel: formatDateWithHoliday(d.date), noSchool, visits };
}

/** 学校（連絡帳・担任の先生）に伝える、週のデイの予定 */
export function schoolWeekMessage(args: { child: Child; days: readonly SchoolDay[]; skipWeekends?: boolean }): string {
  const days = args.skipWeekends === false ? args.days : args.days.filter((d) => !isWeekend(d.date));
  const lines = days.map((d) => {
    const line = schoolDayLine(args.child, d);
    if (line.noSchool) return `${line.dateLabel} ${[line.noSchool, line.visits].filter(Boolean).join('・')}`;
    return `${line.dateLabel} ${line.visits || 'デイなし'}`;
  });
  return [`${args.child.name}のデイの予定です。`, '', ...lines, '', 'よろしくお願いいたします。'].join('\n');
}

function isWeekend(date: string): boolean {
  const day = weekdayIndex(date);
  return day === 0 || day === 6;
}
