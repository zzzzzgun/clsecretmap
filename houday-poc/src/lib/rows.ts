import type { Certificate, Plan, PlanStatus } from '@/lib/domain/schedule';

// DB の行（snake_case）をドメインの型（camelCase）に変換する

export interface PlanRow {
  id: string;
  child_id: string;
  facility_id: string;
  date: string;
  pickup_time: string | null;
  return_time: string | null;
  status: PlanStatus;
  note: string | null;
}

export const PLAN_COLUMNS = 'id, child_id, facility_id, date, pickup_time, return_time, status, note';

export function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    childId: row.child_id,
    facilityId: row.facility_id,
    date: row.date,
    pickupTime: row.pickup_time,
    returnTime: row.return_time,
    status: row.status,
  };
}

export interface CertificateRow {
  valid_from: string;
  valid_until: string;
  monthly_days: number;
}

export function toCertificate(row: CertificateRow): Certificate {
  return { validFrom: row.valid_from, validUntil: row.valid_until, monthlyDays: row.monthly_days };
}

export interface FacilityRow {
  id: string;
  name: string;
  color: string;
  archived: boolean;
}
