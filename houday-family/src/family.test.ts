import 'fake-indexeddb/auto';
import { weeklySchoolSchedule } from '@domain/schedule';
import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from './backup';
import { requestMessage, schoolWeekMessage } from './messages';
import { emptyState, MAX_HISTORY, type AppState, type PlanEntry } from './model';
import { reducer } from './reducer';
import { allPhotoIds, deletePhoto, getPhoto, loadState, putPhoto, saveState } from './storage';

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
      childName: 'たろう',
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
    expect(text).toContain('・11/4(水)\n・11/6(金) 迎え 15:00');
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
    const text = schoolWeekMessage({ childName: 'たろう', days });
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
