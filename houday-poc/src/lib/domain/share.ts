import { createHash, randomBytes } from 'node:crypto';
import { isSupportBookSection, type SupportBookSection } from './support-book';

export type ShareScope = 'schedule' | `sb:${SupportBookSection}`;

/** 共有リンク用のトークン（32バイト = 推測不能）。DB にはハッシュだけを保存する。 */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** get_shared_view() と同じく sha256 の16進表記 */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isShareScope(value: string): value is ShareScope {
  if (value === 'schedule') return true;
  return value.startsWith('sb:') && isSupportBookSection(value.slice(3));
}

export const SHARE_DURATIONS_DAYS = [7, 30, 90, 365] as const;

export function shareExpiry(days: number, now: Date = new Date()): Date {
  const allowed = (SHARE_DURATIONS_DAYS as readonly number[]).includes(days) ? days : 30;
  return new Date(now.getTime() + allowed * 86_400_000);
}
