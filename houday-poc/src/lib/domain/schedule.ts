import {
  addDays,
  daysBetween,
  lastDayOfMonth,
  monthOf,
  type IsoDate,
  type IsoMonth,
} from './dates';

export type PlanStatus = 'planned' | 'cancelled';

export interface Plan {
  id: string;
  childId: string;
  facilityId: string;
  date: IsoDate;
  pickupTime: string | null;
  returnTime: string | null;
  status: PlanStatus;
}

export interface Facility {
  id: string;
  name: string;
}

export interface Certificate {
  validFrom: IsoDate;
  validUntil: IsoDate;
  monthlyDays: number;
}

function planned(plans: readonly Plan[]): Plan[] {
  return plans.filter((p) => p.status === 'planned');
}

/** その月にデイを利用する日数（同じ日に複数入っていても1日と数える） */
export function usedDaysInMonth(plans: readonly Plan[], month: IsoMonth): number {
  return new Set(planned(plans).filter((p) => monthOf(p.date) === month).map((p) => p.date)).size;
}

/**
 * 受給者証で使えるのは1日1事業所まで。
 * 同じ日に別々のデイの予定が入っている日を返す（2か所目以降は全額自己負担になりうる）。
 */
export function findDoubleBookings(plans: readonly Plan[]): Map<IsoDate, string[]> {
  const byDate = new Map<IsoDate, Set<string>>();
  for (const p of planned(plans)) {
    const facilities = byDate.get(p.date) ?? new Set<string>();
    facilities.add(p.facilityId);
    byDate.set(p.date, facilities);
  }
  const result = new Map<IsoDate, string[]>();
  for (const [date, facilities] of byDate) {
    if (facilities.size > 1) result.set(date, [...facilities]);
  }
  return result;
}

/** その月に有効な受給者証（月の途中で切り替わる場合は、月末時点で有効なものを優先） */
export function certificateForMonth(
  certificates: readonly Certificate[],
  month: IsoMonth,
): Certificate | null {
  const first = `${month}-01`;
  const last = lastDayOfMonth(month);
  const overlapping = certificates.filter((c) => c.validFrom <= last && c.validUntil >= first);
  if (overlapping.length === 0) return null;
  return [...overlapping].sort((a, b) => b.validUntil.localeCompare(a.validUntil))[0];
}

export interface MonthlyAllowance {
  limit: number;
  used: number;
  remaining: number;
}

export function monthlyAllowance(
  certificates: readonly Certificate[],
  plans: readonly Plan[],
  month: IsoMonth,
): MonthlyAllowance | null {
  const cert = certificateForMonth(certificates, month);
  if (!cert) return null;
  const used = usedDaysInMonth(plans, month);
  return { limit: cert.monthlyDays, used, remaining: cert.monthlyDays - used };
}

export type CertificateAlert =
  | { kind: 'missing' }
  | { kind: 'expired'; validUntil: IsoDate }
  | { kind: 'expiring'; validUntil: IsoDate; daysLeft: number };

/** 更新の手続きには時間がかかるため、期限の60日前から知らせる */
export const CERTIFICATE_WARNING_DAYS = 60;

export function certificateAlert(
  certificates: readonly Certificate[],
  today: IsoDate,
): CertificateAlert | null {
  if (certificates.length === 0) return { kind: 'missing' };
  const latest = [...certificates].sort((a, b) => b.validUntil.localeCompare(a.validUntil))[0];
  if (latest.validUntil < today) return { kind: 'expired', validUntil: latest.validUntil };
  const daysLeft = daysBetween(today, latest.validUntil);
  if (daysLeft <= CERTIFICATE_WARNING_DAYS) {
    return { kind: 'expiring', validUntil: latest.validUntil, daysLeft };
  }
  return null;
}

export interface SchoolDay {
  date: IsoDate;
  visits: { facilityName: string; pickupTime: string | null }[];
}

/** 学校の先生向け: 週の各日にどのデイが何時に迎えに来るか（予定がなければ visits は空 = 帰宅） */
export function weeklySchoolSchedule(
  plans: readonly Plan[],
  facilities: readonly Facility[],
  weekStart: IsoDate,
  days = 7,
): SchoolDay[] {
  const names = new Map(facilities.map((f) => [f.id, f.name]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(weekStart, i);
    const visits = planned(plans)
      .filter((p) => p.date === date)
      .sort((a, b) => (a.pickupTime ?? '').localeCompare(b.pickupTime ?? ''))
      .map((p) => ({ facilityName: names.get(p.facilityId) ?? '（削除されたデイ）', pickupTime: p.pickupTime }));
    return { date, visits };
  });
}

/** 'HH:MM:SS' → 'HH:MM' */
export function shortTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}
