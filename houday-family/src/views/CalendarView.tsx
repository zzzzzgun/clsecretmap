import { addMonths, datesInMonth, monthOf, todayInTokyo, weekdayIndex } from '@domain/dates';
import { formatDateWithHoliday, holidayName, holidaysInMonth } from '@domain/holidays';
import { certificateAlert, findDoubleBookings, monthlyAllowance } from '@domain/schedule';
import { useState, type FormEvent } from 'react';
import { FacilitySelect, field } from '../components';
import { dayKindNote, defaultPlanTimes, planTimesText, type PlanTimes } from '../dayType';
import type { Child, PlanEntry } from '../model';
import { newId, useStore } from '../store';
import { PlanEditForm, TimesFields } from './PlanForms';

const WEEKDAY_HEADERS = ['月', '火', '水', '木', '金', '土', '日'];

function monthTitle(month: string) {
  return `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
}

export function CalendarView({ child, goTo }: { child: Child; goTo: (tab: 'settings') => void }) {
  const { state, dispatch } = useStore();
  const today = todayInTokyo();
  const [month, setMonth] = useState(monthOf(today));
  const defaultAddDate = month === monthOf(today) ? today : `${month}-01`;
  const activeFacilities = state.facilities.filter((f) => !f.archived);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [addFacilityId, setAddFacilityId] = useState<string | null>(null);
  const [addTimes, setAddTimes] = useState<PlanTimes | null>(null);
  const [weeklyNotice, setWeeklyNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function changeMonth(delta: number) {
    setMonth(addMonths(month, delta));
    setAddDate(null);
    setAddTimes(null);
    setWeeklyNotice(null);
  }

  const facilityById = new Map(state.facilities.map((f) => [f.id, f]));
  const childPlans = state.plans.filter((p) => p.childId === child.id);
  const monthPlans = childPlans
    .filter((p) => monthOf(p.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.pickupTime ?? '').localeCompare(b.pickupTime ?? ''));
  const certificates = state.certificates.filter((c) => c.childId === child.id);

  const allowance = monthlyAllowance(certificates, childPlans, month);
  const doubleBookings = findDoubleBookings(monthPlans);
  const certAlert = certificateAlert(certificates, today);

  const dates = datesInMonth(month);
  const holidays = holidaysInMonth(month);
  const currentAddDate = addDate ?? defaultAddDate;
  const currentFacilityId = addFacilityId && activeFacilities.some((f) => f.id === addFacilityId) ? addFacilityId : activeFacilities[0]?.id ?? '';
  const currentFacility = state.facilities.find((f) => f.id === currentFacilityId);
  // 日付やデイを変えたら、その日のふだんどおりの時刻を入れ直す
  const currentTimes = addTimes ?? defaultPlanTimes(child, currentFacility, currentAddDate);
  const addDateHoliday = holidayName(currentAddDate);
  const missingSchoolTimes = !child.dismissal || Object.keys(child.dismissal).length === 0;
  const leadingBlanks = (weekdayIndex(dates[0]) + 6) % 7;

  if (state.facilities.length === 0) {
    return (
      <p className="notice info">
        まず<button className="link" onClick={() => goTo('settings')}>設定</button>で、通っているデイを登録してください。
      </p>
    );
  }

  function addOne(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    dispatch({
      type: 'addPlans',
      plans: [
        {
          id: newId(),
          childId: child.id,
          facilityId: currentFacilityId,
          date: currentAddDate,
          ...currentTimes,
          status: 'planned',
          note: field(form, 'note'),
        },
      ],
    });
    e.currentTarget.reset();
    setAddDate(null);
    setAddTimes(null);
  }

  function addWeekly(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const weekdays = new Set(form.getAll('weekday').map(Number));
    const facilityId = field(form, 'facilityId');
    const facility = state.facilities.find((f) => f.id === facilityId);
    // 祝日はデイの利用時間や送迎が変わることが多いので、初期設定では入れない
    const skipHolidays = form.get('skipHolidays') === 'yes';
    const candidates = dates.filter((d) => d >= today && weekdays.has(weekdayIndex(d)));
    const skipped = skipHolidays ? candidates.filter((d) => holidayName(d)) : [];
    const plans: PlanEntry[] = candidates
      .filter((d) => !skipped.includes(d))
      // 時刻はその日の種類（学校から／家から）と、設定の下校時刻・デイのいつもの時刻から入れる
      .map((date) => ({
        id: newId(),
        childId: child.id,
        facilityId,
        date,
        ...defaultPlanTimes(child, facility, date),
        status: 'planned',
        note: '',
      }));
    if (plans.length > 0) dispatch({ type: 'addPlans', plans });
    setWeeklyNotice(
      skipped.length > 0
        ? `${plans.length}日分を追加しました。祝日の ${skipped.map(formatDateWithHoliday).join('、')} は入れていません。必要なら「予定を追加」で1日ずつ入れてください。`
        : `${plans.length}日分を追加しました。`,
    );
    e.currentTarget.reset();
  }

  return (
    <>
      {certAlert?.kind === 'missing' && (
        <p className="notice warn">
          受給者証が未登録です。<button className="link" onClick={() => goTo('settings')}>設定</button>で登録すると、残りの日数がわかります。
        </p>
      )}
      {certAlert?.kind === 'expiring' && (
        <p className="notice warn">
          受給者証の有効期限（{certAlert.validUntil}）まであと{certAlert.daysLeft}日です。更新の手続きをお忘れなく。
        </p>
      )}
      {certAlert?.kind === 'expired' && (
        <p className="notice danger">受給者証の有効期限（{certAlert.validUntil}）が切れています。</p>
      )}

      {doubleBookings.size > 0 && (
        <div className="notice danger">
          同じ日に2か所のデイが入っています。受給者証で使えるのは1日1か所までで、2か所目は全額自己負担になることがあります。
          <ul>
            {[...doubleBookings.entries()].map(([date, ids]) => (
              <li key={date}>
                {formatDateWithHoliday(date)}: {ids.map((id) => facilityById.get(id)?.name).join('、')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="month-nav">
        <button className="small secondary" aria-label="前の月" onClick={() => changeMonth(-1)}>
          ← 前
        </button>
        <strong>{monthTitle(month)}</strong>
        <button className="small secondary" aria-label="次の月" onClick={() => changeMonth(1)}>
          次 →
        </button>
      </div>

      {allowance && (
        <p className={allowance.remaining < 0 ? 'notice danger' : 'notice info'}>
          利用 {allowance.used}日 / 支給 {allowance.limit}日（
          {allowance.remaining >= 0 ? `残り${allowance.remaining}日` : `${-allowance.remaining}日オーバー`}）
        </p>
      )}

      <div className="calendar">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {dates.map((date) => {
          const holiday = holidayName(date);
          const weekday = weekdayIndex(date);
          const classes = [
            'day',
            holiday && 'holiday',
            weekday === 0 && 'sunday',
            weekday === 6 && 'saturday',
            date === today && 'today',
            doubleBookings.has(date) && 'conflict',
          ].filter(Boolean);
          return (
            <div key={date} className={classes.join(' ')} title={holiday ?? undefined}>
              <span className="num">{Number(date.slice(8))}</span>
              {holiday && <span className="holiday-mark">祝</span>}
              {monthPlans
                .filter((p) => p.date === date && p.status === 'planned')
                .map((p) => {
                  const f = facilityById.get(p.facilityId);
                  return (
                    // マスが狭いので頭の2文字だけ。どのデイかは色と下の凡例で分かる
                    <span key={p.id} className="chip" style={{ background: f?.color }} title={f?.name}>
                      {Array.from(f?.name ?? '').slice(0, 2).join('')}
                    </span>
                  );
                })}
            </div>
          );
        })}
      </div>

      {holidays.length > 0 && (
        <p className="holiday-list">
          この月の祝日：{holidays.map((h) => `${formatDateWithHoliday(h.date)} ${h.name}`).join('、')}
        </p>
      )}

      <p className="legend">
        {state.facilities
          .filter((f) => !f.archived)
          .map((f) => (
            <span key={f.id}>
              <span className="swatch" style={{ background: f.color }} />
              {f.name}
            </span>
          ))}
      </p>

      <h2>予定を追加</h2>
      {missingSchoolTimes && (
        <p className="notice info">
          <button className="link" onClick={() => goTo('settings')}>設定</button>で下校時刻とデイのいつもの時刻を入れておくと、お迎え・帰宅の時刻が自動で入ります。
        </p>
      )}
      <form onSubmit={addOne} className="card">
        <div className="row">
          <div>
            <label htmlFor="plan-date">日付</label>
            <input
              id="plan-date"
              name="date"
              type="date"
              required
              key={defaultAddDate}
              defaultValue={defaultAddDate}
              onChange={(e) => {
                if (!e.target.value) return;
                setAddDate(e.target.value);
                setAddTimes(null);
              }}
            />
          </div>
          <div>
            <label htmlFor="plan-facility">デイ</label>
            <select
              id="plan-facility"
              value={currentFacilityId}
              onChange={(e) => {
                setAddFacilityId(e.target.value);
                setAddTimes(null);
              }}
            >
              {activeFacilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className={addDateHoliday ? 'day-note holiday-text' : 'day-note'}>{dayKindNote(child, currentAddDate)}</p>
        <TimesFields
          idPrefix="plan"
          child={child}
          facilityId={currentFacilityId}
          date={currentAddDate}
          value={currentTimes}
          onChange={setAddTimes}
        />
        {addDateHoliday && (
          <p className="notice warn">
            この日は祝日（{addDateHoliday}）です。デイの利用時間や送迎が普段と違うことがあるので、時刻を確かめてください。
          </p>
        )}
        <label htmlFor="plan-note">メモ</label>
        <input id="plan-note" name="note" type="text" maxLength={200} />
        <button type="submit">追加</button>
      </form>

      <details className="card">
        <summary>曜日でまとめて追加（{monthTitle(month)}）</summary>
        <form onSubmit={addWeekly}>
          <label htmlFor="weekly-facility">デイ</label>
          <FacilitySelect id="weekly-facility" />
          <label>曜日</label>
          <div className="weekdays">
            {WEEKDAY_HEADERS.map((label, i) => (
              <label key={label}>
                <input type="checkbox" name="weekday" value={(i + 1) % 7} />
                {label}
              </label>
            ))}
          </div>
          <p className="muted">
            お迎え・帰宅の時刻は、平日は下校時刻（曜日ごとの授業時間）、土日・祝日・学校が休みの期間は「家から」の時刻で自動で入ります。違う日は、下の一覧の「時刻」で直せます。
          </p>
          <label className="inline">
            <input type="checkbox" name="skipHolidays" value="yes" defaultChecked />
            <span>祝日には入れない（祝日は利用時間や送迎が変わることが多いため）</span>
          </label>
          <p className="muted">今日より前の日には追加しません。</p>
          <button type="submit">まとめて追加</button>
          {weeklyNotice && <p className="notice info">{weeklyNotice}</p>}
        </form>
      </details>

      <h2>この月の予定</h2>
      <div className="card">
        {monthPlans.length === 0 && <p className="muted">まだ予定がありません。</p>}
        <ul className="plan-list">
          {monthPlans.map((p) => {
            const f = facilityById.get(p.facilityId);
            const times = planTimesText(child, p);
            return (
              <li key={p.id} className={p.status === 'cancelled' ? 'cancelled' : undefined}>
                <span className="what">
                  <span className="swatch" style={{ background: f?.color }} />
                  <strong className={holidayName(p.date) ? 'holiday-text' : undefined}>{formatDateWithHoliday(p.date)}</strong>{' '}
                  {f?.name}
                  {holidayName(p.date) && <span className="sub holiday-text">{holidayName(p.date)}</span>}
                  {times && <span className="sub">{times}</span>}
                  {p.note && <span className="sub">メモ: {p.note}</span>}
                </span>
                <span className="actions">
                  <button
                    className="small secondary"
                    onClick={() =>
                      dispatch({ type: 'setPlanStatus', id: p.id, status: p.status === 'planned' ? 'cancelled' : 'planned' })
                    }
                  >
                    {p.status === 'planned' ? 'お休み' : '戻す'}
                  </button>
                  {p.status === 'planned' && (
                    <button className="small secondary" onClick={() => setEditingId(editingId === p.id ? null : p.id)}>
                      時刻
                    </button>
                  )}
                  <button className="small danger" onClick={() => dispatch({ type: 'removePlan', id: p.id })}>
                    削除
                  </button>
                </span>
                {editingId === p.id && <PlanEditForm child={child} plan={p} onDone={() => setEditingId(null)} />}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
