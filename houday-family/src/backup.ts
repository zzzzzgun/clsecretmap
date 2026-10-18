import { isSupportBookSection } from '@domain/support-book';
import { SCHEMA_VERSION, type AppState } from './model';

// バックアップファイル（JSON）。写真も含めて1ファイルにする。
// 機種変更や、ブラウザのデータが消えたときに、ここから戻す。

const APP_TAG = 'houday-family';

export interface BackupPhoto {
  id: string;
  type: string;
  /** base64 */
  data: string;
}

export interface BackupFile {
  app: typeof APP_TAG;
  exportedAt: string;
  state: AppState;
  photos: BackupPhoto[];
}

export function buildBackup(state: AppState, photos: BackupPhoto[], now: Date): BackupFile {
  return { app: APP_TAG, exportedAt: now.toISOString(), state, photos };
}

export function backupFileName(now: Date): string {
  const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
  return `day-techo-backup-${stamp}.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isDate = (v: unknown): v is string => isString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTimeOrNull = (v: unknown) => v === null || (isString(v) && /^\d{2}:\d{2}(:\d{2})?$/.test(v));

function check(cond: boolean, what: string): asserts cond {
  if (!cond) throw new Error(`バックアップファイルの${what}が読み取れません。デイ手帳で書き出したファイルか確かめてください。`);
}

function everyItem(value: unknown, test: (item: Record<string, unknown>) => boolean, what: string) {
  check(Array.isArray(value) && value.every((item) => isObject(item) && test(item)), what);
}

/** 読み込んだファイルの中身を確かめる。おかしなファイルで今のデータを壊さないため。 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('ファイルを読み取れません。デイ手帳で書き出したバックアップファイルを選んでください。');
  }
  check(isObject(raw) && raw.app === APP_TAG, '形式');
  const state = raw.state;
  check(isObject(state), '中身');
  check(state.version === SCHEMA_VERSION, 'バージョン');

  everyItem(state.children, (c) => isString(c.id) && isString(c.name), 'お子さんの情報');
  everyItem(state.facilities, (f) => isString(f.id) && isString(f.name) && isString(f.color), 'デイの情報');
  everyItem(
    state.certificates,
    (c) => isString(c.id) && isString(c.childId) && isDate(c.validFrom) && isDate(c.validUntil) && Number.isInteger(c.monthlyDays),
    '受給者証の情報',
  );
  everyItem(
    state.plans,
    (p) =>
      isString(p.id) &&
      isString(p.childId) &&
      isString(p.facilityId) &&
      isDate(p.date) &&
      isTimeOrNull(p.pickupTime) &&
      isTimeOrNull(p.returnTime) &&
      (p.status === 'planned' || p.status === 'cancelled'),
    '予定',
  );
  everyItem(
    state.logs,
    (l) => isString(l.id) && isString(l.childId) && isDate(l.date) && isString(l.text) && Array.isArray(l.photoIds),
    '様子の記録',
  );
  check(isObject(state.supportBook), 'サポートブック');
  for (const book of Object.values(state.supportBook)) {
    check(isObject(book), 'サポートブック');
    for (const [section, item] of Object.entries(book)) {
      check(isSupportBookSection(section) && isObject(item) && isString(item.body) && Array.isArray(item.history), 'サポートブック');
    }
  }
  everyItem(raw.photos, (p) => isString(p.id) && isString(p.type) && isString(p.data), '写真');

  return raw as unknown as BackupFile;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(data: string, type: string): Blob {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}
