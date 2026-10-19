import type { IsoDate } from '@domain/dates';
import type { PlanStatus } from '@domain/schedule';
import type { SupportBookSection } from '@domain/support-book';

// 家庭用ツールのデータは全てこの1つの形で端末の中（IndexedDB）に保存する。
// 写真だけは大きいので別の保存場所に置き、ここには ID だけを持つ。

export const SCHEMA_VERSION = 1;

/** 学校が休みの期間（夏休みなど）。平日でも家からデイに行く */
export interface SchoolBreak {
  id: string;
  label: string;
  from: IsoDate;
  until: IsoDate;
}

export interface Child {
  id: string;
  name: string;
  school: string;
  grade: string;
  /** 授業の時間数ごとの下校時刻。例: { '5': '14:40', '6': '15:30' } */
  dismissal?: Partial<Record<string, string>>;
  /** 曜日（1=月〜5=金）ごとの、ふだんの授業の時間数 */
  weeklyPeriods?: Partial<Record<string, number>>;
  schoolBreaks?: SchoolBreak[];
}

export interface Facility {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  /** 学校からデイに行った日の、ふだんの帰宅時刻 */
  weekdayReturn?: string | null;
  /** 土日・祝日・学校が休みの日の、家へのお迎え時刻と帰宅時刻 */
  homePickup?: string | null;
  homeReturn?: string | null;
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
  /** どこから迎えに来てもらうか（古いデータにはない） */
  pickupFrom?: PickupFrom;
  /** 学校から行く日の授業の時間数 */
  periods?: number | null;
}

export type PickupFrom = 'school' | 'home';

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

/** 下校時刻を登録できる授業の時間数 */
export const PERIOD_OPTIONS = [3, 4, 5, 6, 7] as const;

export const FACILITY_COLORS = ['#2f6fde', '#e0782b', '#2a9d6a', '#b04fc4', '#c9483f', '#7a6a2f'];

/** 書き直し前の内容をいくつまで残すか（1項目あたり） */
export const MAX_HISTORY = 50;
