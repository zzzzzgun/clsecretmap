import type { IsoDate } from '@domain/dates';
import type { PlanStatus } from '@domain/schedule';
import type { SupportBookSection } from '@domain/support-book';

// 家庭用ツールのデータは全てこの1つの形で端末の中（IndexedDB）に保存する。
// 写真だけは大きいので別の保存場所に置き、ここには ID だけを持つ。

export const SCHEMA_VERSION = 1;

export interface Child {
  id: string;
  name: string;
  school: string;
  grade: string;
}

export interface Facility {
  id: string;
  name: string;
  color: string;
  archived: boolean;
}

export interface Certificate {
  id: string;
  childId: string;
  validFrom: IsoDate;
  validUntil: IsoDate;
  monthlyDays: number;
}

export interface PlanEntry {
  id: string;
  childId: string;
  facilityId: string;
  date: IsoDate;
  pickupTime: string | null;
  returnTime: string | null;
  status: PlanStatus;
  note: string;
}

export interface SupportBookRevision {
  body: string;
  updatedAt: string;
}

export interface SupportBookItem {
  body: string;
  updatedAt: string;
  /** 新しい順。書き直す前の内容 */
  history: SupportBookRevision[];
}

/** その日のデイでの様子（連絡帳の内容や、迎えのときに聞いたこと） */
export interface DayLog {
  id: string;
  childId: string;
  date: IsoDate;
  facilityId: string | null;
  text: string;
  photoIds: string[];
  createdAt: string;
}

export interface AppState {
  version: typeof SCHEMA_VERSION;
  children: Child[];
  facilities: Facility[];
  certificates: Certificate[];
  plans: PlanEntry[];
  supportBook: Record<string, Partial<Record<SupportBookSection, SupportBookItem>>>;
  logs: DayLog[];
  lastBackupAt: string | null;
}

export function emptyState(): AppState {
  return {
    version: SCHEMA_VERSION,
    children: [],
    facilities: [],
    certificates: [],
    plans: [],
    supportBook: {},
    logs: [],
    lastBackupAt: null,
  };
}

export const FACILITY_COLORS = ['#2f6fde', '#e0782b', '#2a9d6a', '#b04fc4', '#c9483f', '#7a6a2f'];

/** 書き直し前の内容をいくつまで残すか（1項目あたり） */
export const MAX_HISTORY = 50;
