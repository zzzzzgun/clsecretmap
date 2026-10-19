import 'fake-indexeddb/auto';
import { weeklySchoolSchedule } from '@domain/schedule';
import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from './backup';
import { dayKind, defaultPlanTimes, facilityClosedReason, outsideHoursWarning, planTimesText } from './dayType';
import { requestMessage, schoolWeekMessage } from './messages';
import { emptyState, MAX_HISTORY, type AppState, type PlanEntry } from './model';
import { reducer } from './reducer';
import { allPhotoIds, deletePhoto, getPhoto, loadState, putPhoto, saveState } from './storage';

const TARO = { id: 'c1', name: 'たろう', school: '', grade: '' };

function plan(date: string, extra: Partial<PlanEntry> = {}): PlanEntry {
  return {
    id: date,
    childId: 'c1',
    facilityId: 'f1',
    date,
    pickupTime: null,
    returnTime: null,
    status: 'planned',
    note: '',
    ...extra,
  };
}

function sampleState(): AppState {
  let s = emptyState();
  s = reducer(s, { type: 'addChild', child: { id: 'c1', name: 'たろう', school: '', grade: '' } });
  s = reducer(s, { type: 'addChild', child: { id: 'c2', name: 'はなこ', school: '', grade: '' } });
  s = reducer(s, { type: 'addFacility', id: 'f1', name: 'ひまわりデイ' });
  s = reducer(s, { type: 'addPlans', plans: [plan('2026-11-04'), plan('2026-11-05', { childId: 'c2', id: 'p2' })] });
  s = reducer(s, {
    type: 'addCertificate',
    certificate: { id: 'k1', childId: 'c1', validFrom: '2026-04-01', validUntil: '2027-03-31', monthlyDays: 10 },
  });
  s = reducer(s, {
    type: 'addLog',
    log: { id: 'l1', childId: 'c1', date: '2026-11-04', facilityId: 'f1', text: '公園に行った', photoIds: [], createdAt: '' },
  });
  return s;
}

describe('データの更新', () => {
  it('デイには順番に色が付く', () => {
    let s = emptyState();
    s = reducer(s, { type: 'addFacility', id: 'a', name: 'A' });
    s = reducer(s, { type: 'addFacility', id: 'b', name: 'B' });
    expect(s.facilities[0].color).not.toBe(s.facilities[1].color);
  });

  it('子どもを削除すると、その子の予定・受給者証・記録・サポートブックも消える（きょうだいの分は残る）', () => {
    let s = sampleState();
    s = reducer(s, { type: 'saveSupportBook', childId: 'c1', section: 'likes', body: '電車', now: 't1' });
    s = reducer(s, { type: 'removeChild', childId: 'c1' });
    expect(s.children.map((c) => c.id)).toEqual(['c2']);
    expect(s.plans.map((p) => p.childId)).toEqual(['c2']);
    expect(s.certificates).toEqual([]);
    expect(s.logs).toEqual([]);
    expect(s.supportBook.c1).toBeUndefined();
  });

  it('サポートブックを書き直すと前の内容が履歴に残り、同じ内容なら何も変えない', () => {
    let s = emptyState();
    s = reducer(s, { type: 'saveSupportBook', childId: 'c1', section: 'likes', body: '電車', now: 't1' });
    s = reducer(s, { type: 'saveSupportBook', childId: 'c1', section: 'likes', body: '電車と恐竜', now: 't2' });
    const same = reducer(s, { type: 'saveSupportBook', childId: 'c1', section: 'likes', body: '電車と恐竜', now: 't3' });
    expect(same).toBe(s);
    expect(s.supportBook.c1?.likes).toEqual({
      body: '電車と恐竜',
      updatedAt: 't2',
      history: [{ body: '電車', updatedAt: 't1' }],
    });
  });

  it('履歴は決めた数までしか残さない', () => {
    let s = emptyState();
    for (let i = 0; i <= MAX_HISTORY + 5; i++) {
      s = reducer(s, { type: 'saveSupportBook', childId: 'c1', section: 'basic', body: `v${i}`, now: `t${i}` });
    }
    expect(s.supportBook.c1?.basic?.history).toHaveLength(MAX_HISTORY);
    expect(s.supportBook.c1?.basic?.history[0].body).toBe(`v${MAX_HISTORY + 4}`);
  });
});

describe('文面の作成', () => {
  it('デイへの利用希望日の文面に、その月の予定だけを日付順で入れる', () => {
    const text = requestMessage({
      child: TARO,
      facilityName: 'ひまわりデイ',
      month: '2026-11',
      plans: [
        plan('2026-11-06', { pickupTime: '15:00' }),
        plan('2026-11-04'),
        plan('2026-11-05', { status: 'cancelled' }),
        plan('2026-12-01'),
      ],
    });
    expect(text).toContain('たろうの11月の利用希望日');
    expect(text).toContain('・11/4(水) 学校お迎え\n・11/6(金) 学校お迎え 15:00');
    expect(text).not.toContain('11/5');
    expect(text).not.toContain('12/1');
    expect(text).toContain('計2日です');
  });

  it('学校向けの文面は平日だけを並べ、予定のない日は「デイなし」', () => {
    const days = weeklySchoolSchedule(
      [plan('2026-10-19', { pickupTime: '14:45:00' })],
      [{ id: 'f1', name: 'ひまわりデイ' }],
      '2026-10-19',
    );
    const text = schoolWeekMessage({ child: TARO, days });
    expect(text).toContain('10/19(月) ひまわりデイ（迎え 14:45）');
    expect(text).toContain('10/20(火) デイなし');
    expect(text).not.toContain('(土)');
    expect(text).not.toContain('(日)');
  });
});

describe('バックアップ', () => {
  it('書き出したものをそのまま読み戻せる', () => {
    const state = sampleState();
    const file = buildBackup(state, [{ id: 'ph1', type: 'image/jpeg', data: 'AAAA' }], new Date('2026-10-18T00:00:00Z'));
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.state).toEqual(state);
    expect(parsed.photos).toHaveLength(1);
  });

  it('関係のないファイルや壊れたファイルは読み込まない', () => {
    expect(() => parseBackup('not json')).toThrow('読み取れません');
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow('形式');
    const file = buildBackup(sampleState(), [], new Date());
    (file.state.plans[0] as unknown as Record<string, unknown>).date = '11月4日';
    expect(() => parseBackup(JSON.stringify(file))).toThrow('予定');
  });
});

describe('端末への保存', () => {
  it('データと写真を保存して読み出せる', async () => {
    const state = sampleState();
    await saveState(state);
    expect(await loadState()).toEqual(state);

    await putPhoto('ph1', new Blob(['x'], { type: 'image/jpeg' }));
    expect(await allPhotoIds()).toEqual(['ph1']);
    expect(await getPhoto('ph1')).toBeDefined();
    await deletePhoto('ph1');
    expect(await allPhotoIds()).toEqual([]);
  });
});

describe('祝日の反映', () => {
  it('デイへの希望日の文面では祝日に「祝」が付く', () => {
    const text = requestMessage({
      child: TARO,
      facilityName: 'ひまわりデイ',
      month: '2026-10',
      plans: [plan('2026-10-12', { pickupTime: '09:30' }), plan('2026-10-13')],
    });
    expect(text).toContain('・10/12(月・祝) 自宅お迎え 09:30\n・10/13(火) 学校お迎え');
  });

  it('学校向けの文面では祝日の名前を出し、デイに行くならその予定を添える', () => {
    const days = weeklySchoolSchedule(
      [plan('2026-09-21', { pickupTime: '09:30:00' })],
      [{ id: 'f1', name: 'ひまわりデイ' }],
      '2026-09-21',
      5,
    );
    const text = schoolWeekMessage({ child: TARO, days });
    expect(text).toContain('9/21(月・祝) 敬老の日・ひまわりデイ（家から）');
    expect(text).toContain('9/22(火・祝) 国民の休日');
    expect(text).toContain('9/24(木) デイなし');
  });
});

describe('平日と土日・祝日の違い', () => {
  const child = {
    id: 'c1',
    name: 'たろう',
    school: '',
    grade: '',
    dismissal: { '5': '14:40', '6': '15:30' },
    weeklyPeriods: { '1': 6, '2': 5, '3': 5, '4': 6, '5': 5 },
    schoolBreaks: [{ id: 'b1', label: '冬休み', from: '2026-12-25', until: '2027-01-07' }],
  };
  const facility = { id: 'f1', name: 'ひまわりデイ', color: '#000', archived: false, weekdayReturn: '17:30', homePickup: '09:30', homeReturn: '16:00' };

  it('平日は学校から。曜日の授業時間から下校時刻が入る', () => {
    expect(defaultPlanTimes(child, facility, '2026-11-02')).toEqual({ pickupFrom: 'school', periods: 6, pickupTime: '15:30', returnTime: '17:30' });
    expect(defaultPlanTimes(child, facility, '2026-11-04')).toEqual({ pickupFrom: 'school', periods: 5, pickupTime: '14:40', returnTime: '17:30' });
  });

  it('土日・祝日・学校が休みの期間は家から', () => {
    const home = { pickupFrom: 'home', periods: null, pickupTime: '09:30', returnTime: '16:00' };
    expect(defaultPlanTimes(child, facility, '2026-11-07')).toEqual(home);
    expect(defaultPlanTimes(child, facility, '2026-11-03')).toEqual(home);
    expect(defaultPlanTimes(child, facility, '2026-12-25')).toEqual(home);
    expect(dayKind(child, '2026-12-25')).toEqual({ kind: 'home', reason: 'break', label: '冬休み' });
  });

  it('下校時刻やデイの時刻が未登録なら空のまま', () => {
    const bare = { id: 'c2', name: 'はなこ', school: '', grade: '' };
    expect(defaultPlanTimes(bare, undefined, '2026-11-02')).toEqual({ pickupFrom: 'school', periods: null, pickupTime: null, returnTime: null });
  });

  it('お迎えの説明文', () => {
    expect(planTimesText(child, { date: '2026-11-02', pickupFrom: 'school', periods: 6, pickupTime: '15:30', returnTime: '17:30:00' })).toBe(
      '学校お迎え 15:30（6時間）・帰宅 17:30',
    );
    expect(planTimesText(child, { date: '2026-11-07', pickupTime: '09:30', returnTime: null })).toBe('自宅お迎え 09:30');
  });
});

describe('学校から／家からの文面', () => {
  const child = {
    ...TARO,
    dismissal: { '6': '15:30' },
    schoolBreaks: [{ id: 'b1', label: '冬休み', from: '2026-12-25', until: '2027-01-07' }],
  };

  it('デイへの文面に、学校お迎え（授業時間）と自宅お迎えを書き分ける', () => {
    const text = requestMessage({
      child,
      facilityName: 'ひまわりデイ',
      month: '2026-12',
      plans: [
        plan('2026-12-21', { pickupFrom: 'school', periods: 6, pickupTime: '15:30', returnTime: '17:30' }),
        plan('2026-12-26', { pickupFrom: 'home', pickupTime: '09:30', returnTime: '16:00' }),
      ],
    });
    expect(text).toContain('・12/21(月) 学校お迎え 15:30（6時間）・帰宅 17:30');
    expect(text).toContain('・12/26(土) 自宅お迎え 09:30・帰宅 16:00');
  });

  it('学校向けの文面では、学校が休みの期間は理由を書き、お迎え時刻は書かない', () => {
    const days = weeklySchoolSchedule(
      [plan('2026-12-25', { pickupFrom: 'home', pickupTime: '09:30' }), plan('2026-12-24', { pickupTime: '15:30' })],
      [{ id: 'f1', name: 'ひまわりデイ' }],
      '2026-12-21',
      5,
    );
    const text = schoolWeekMessage({ child, days });
    expect(text).toContain('12/24(木) ひまわりデイ（迎え 15:30）');
    expect(text).toContain('12/25(金) 冬休み・ひまわりデイ（家から）');
  });
});

describe('デイの営業日・営業時間', () => {
  const f = {
    id: 'f1', name: 'ひまわりデイ', color: '#000', archived: false,
    openOnHolidays: false, closedWeekdays: [0],
    hours: { school: { open: '13:00', close: '18:00' }, home: { open: '09:00', close: '17:00' } },
  };
  it('祝日休み・定休日を判定する', () => {
    expect(facilityClosedReason(f, '2026-11-03')).toBe('祝日は休み');
    expect(facilityClosedReason(f, '2026-11-08')).toBe('日曜定休');
    expect(facilityClosedReason(f, '2026-11-07')).toBeNull();
    expect(facilityClosedReason({ ...f, openOnHolidays: undefined }, '2026-11-03')).toBeNull();
  });
  it('営業時間の外なら知らせる', () => {
    expect(outsideHoursWarning(f, { pickupFrom: 'home', pickupTime: '08:30', returnTime: '16:00' })).toBe('お迎え 08:30 が営業時間（09:00〜17:00）より前です');
    expect(outsideHoursWarning(f, { pickupFrom: 'school', pickupTime: '15:00', returnTime: '18:30' })).toBe('帰宅 18:30 が営業時間（13:00〜18:00）より後です');
    expect(outsideHoursWarning(f, { pickupFrom: 'school', pickupTime: '15:00', returnTime: '17:30' })).toBeNull();
  });
});
