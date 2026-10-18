import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addMonths, datesInMonth, mondayOf, todayInTokyo, formatJapaneseDate } from './dates';
import {
  certificateAlert,
  certificateForMonth,
  findDoubleBookings,
  monthlyAllowance,
  usedDaysInMonth,
  weeklySchoolSchedule,
  type Plan,
} from './schedule';
import { generateShareToken, hashShareToken, isShareScope, shareExpiry } from './share';

function plan(date: string, facilityId: string, extra: Partial<Plan> = {}): Plan {
  return {
    id: `${date}-${facilityId}`,
    childId: 'c1',
    facilityId,
    date,
    pickupTime: null,
    returnTime: null,
    status: 'planned',
    ...extra,
  };
}

describe('dates', () => {
  it('東京時間で今日の日付を返す（UTCでは前日の時刻でも）', () => {
    expect(todayInTokyo(new Date('2026-10-17T16:30:00Z'))).toBe('2026-10-18');
  });

  it('月の日付を全て返す（うるう年の2月を含む）', () => {
    expect(datesInMonth('2028-02')).toHaveLength(29);
    expect(datesInMonth('2026-11').at(-1)).toBe('2026-11-30');
  });

  it('月をまたいで足し引きできる', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('週の月曜日を返す（日曜は前の週の月曜）', () => {
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
  });

  it('日本語の短い日付にする', () => {
    expect(formatJapaneseDate('2026-10-19')).toBe('10/19(月)');
  });
});

describe('利用日数', () => {
  it('同じ日に2か所入っていても1日と数え、キャンセルは数えない', () => {
    const plans = [
      plan('2026-11-02', 'a'),
      plan('2026-11-02', 'b'),
      plan('2026-11-03', 'a', { status: 'cancelled' }),
      plan('2026-11-04', 'b'),
      plan('2026-12-01', 'a'),
    ];
    expect(usedDaysInMonth(plans, '2026-11')).toBe(2);
  });

  it('受給者証の支給日数から残りを出す', () => {
    const certs = [{ validFrom: '2026-04-01', validUntil: '2027-03-31', monthlyDays: 10 }];
    const plans = [plan('2026-11-02', 'a'), plan('2026-11-04', 'b')];
    expect(monthlyAllowance(certs, plans, '2026-11')).toEqual({ limit: 10, used: 2, remaining: 8 });
  });

  it('受給者証がない月は null', () => {
    const certs = [{ validFrom: '2026-04-01', validUntil: '2027-03-31', monthlyDays: 10 }];
    expect(monthlyAllowance(certs, [], '2027-04')).toBeNull();
  });

  it('月の途中で切り替わるときは月末時点で有効な受給者証を使う', () => {
    const certs = [
      { validFrom: '2025-10-16', validUntil: '2026-10-15', monthlyDays: 10 },
      { validFrom: '2026-10-16', validUntil: '2027-10-15', monthlyDays: 15 },
    ];
    expect(certificateForMonth(certs, '2026-10')?.monthlyDays).toBe(15);
  });
});

describe('重複予約', () => {
  it('同じ日に別々のデイが入っている日だけを返す', () => {
    const plans = [
      plan('2026-11-02', 'a'),
      plan('2026-11-02', 'b'),
      plan('2026-11-03', 'a'),
      plan('2026-11-03', 'a'),
      plan('2026-11-04', 'a'),
      plan('2026-11-04', 'b', { status: 'cancelled' }),
    ];
    const result = findDoubleBookings(plans);
    expect([...result.keys()]).toEqual(['2026-11-02']);
    expect(result.get('2026-11-02')?.sort()).toEqual(['a', 'b']);
  });
});

describe('受給者証の期限', () => {
  const cert = { validFrom: '2026-04-01', validUntil: '2027-03-31', monthlyDays: 10 };

  it('登録がなければ知らせる', () => {
    expect(certificateAlert([], '2026-10-18')).toEqual({ kind: 'missing' });
  });

  it('60日より前なら何も出さない', () => {
    expect(certificateAlert([cert], '2027-01-29')).toBeNull();
  });

  it('60日前から残り日数を知らせる', () => {
    expect(certificateAlert([cert], '2027-01-30')).toEqual({
      kind: 'expiring',
      validUntil: '2027-03-31',
      daysLeft: 60,
    });
  });

  it('期限切れを知らせる', () => {
    expect(certificateAlert([cert], '2027-04-01')).toEqual({ kind: 'expired', validUntil: '2027-03-31' });
  });

  it('新しい受給者証が登録済みなら古い方の期限では知らせない', () => {
    const renewed = { validFrom: '2027-04-01', validUntil: '2028-03-31', monthlyDays: 10 };
    expect(certificateAlert([cert, renewed], '2027-03-20')).toBeNull();
  });
});

describe('学校向けの週間予定', () => {
  it('日ごとに迎えの時刻順に並べ、予定のない日は空にする', () => {
    const facilities = [
      { id: 'a', name: 'ひまわりデイ' },
      { id: 'b', name: 'さくらデイ' },
    ];
    const plans = [
      plan('2026-10-19', 'b', { pickupTime: '15:30:00' }),
      plan('2026-10-19', 'a', { pickupTime: '14:45:00' }),
      plan('2026-10-21', 'a', { status: 'cancelled' }),
    ];
    const week = weeklySchoolSchedule(plans, facilities, '2026-10-19', 5);
    expect(week).toHaveLength(5);
    expect(week[0].visits.map((v) => v.facilityName)).toEqual(['ひまわりデイ', 'さくらデイ']);
    expect(week[2].visits).toEqual([]);
  });
});

describe('共有リンク', () => {
  it('毎回違う、十分に長いトークンを作る', () => {
    const a = generateShareToken();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(generateShareToken());
  });

  it('DB側と同じ sha256 の16進でハッシュする', () => {
    expect(hashShareToken('abc')).toBe(createHash('sha256').update('abc').digest('hex'));
    expect(hashShareToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('許可された範囲の名前だけを受け付ける', () => {
    expect(isShareScope('schedule')).toBe(true);
    expect(isShareScope('sb:medical')).toBe(true);
    expect(isShareScope('sb:unknown')).toBe(false);
    expect(isShareScope('everything')).toBe(false);
  });

  it('期限は決められた日数だけ（それ以外は30日）', () => {
    const now = new Date('2026-10-18T00:00:00Z');
    expect(shareExpiry(7, now).toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(shareExpiry(9999, now).toISOString()).toBe('2026-11-17T00:00:00.000Z');
  });
});
