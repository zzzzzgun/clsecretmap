import {
  addMonths,
  datesInMonth,
  formatJapaneseDate,
  monthOf,
  todayInTokyo,
  weekdayIndex,
} from '@domain/dates';
import { certificateAlert, findDoubleBookings, monthlyAllowance, shortTime } from '@domain/schedule';
import { useState, type FormEvent } from 'react';
import { FacilitySelect, field } from '../components';
import type { Child, PlanEntry } from '../model';
import { newId, useStore } from '../store';

const WEEKDAY_HEADERS = ['月', '火', '水', '木', '金', '土', '日'];

function monthTitle(month: string) {
  return `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
}

export function CalendarView({ child, goTo }: { child: Child; goTo: (tab: 'settings') => void }) {
  const { state, dispatch } = useStore();
  const today = todayInTokyo();
  const [month, setMonth] = useState(monthOf(today));

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
          facilityId: field(form, 'facilityId'),
          date: field(form, 'date'),
          pickupTime: field(form, 'pickupTime') || null,
          returnTime: field(form, 'returnTime') || null,
          status: 'planned',
          note: field(form, 'note'),
        },
      ],
    });
    e.currentTarget.reset();
  }

  function addWeekly(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const weekdays = new Set(form.getAll('weekday').map(Number));
    const facilityId = field(form, 'facilityId');
    const pickupTime = field(form, 'pickupTime') || null;
    const returnTime = field(form, 'returnTime') || null;
    const plans: PlanEntry[] = dates
      .filter((d) => d >= today && weekdays.has(weekdayIndex(d)))
      .map((date) => ({
        id: newId(),
        childId: child.id,
        facilityId,
        date,
        pickupTime,
        returnTime,
        status: 'planned',
        note: '',
      }));
    if (plans.length > 0) dispatch({ type: 'addPlans', plans });
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
                {formatJapaneseDate(date)}: {ids.map((id) => facilityById.get(id)?.name).join('、')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="month-nav">
        <button className="small secondary" onClick={() => setMonth(addMonths(month, -1))}>
          ← 前の月
        </button>
        <strong>{monthTitle(month)}</strong>
        <button className="small secondary" onClick={() => setMonth(addMonths(month, 1))}>
          次の月 →
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
          const classes = ['day', date === today && 'today', doubleBookings.has(date) && 'conflict'].filter(Boolean);
          return (
            <div key={date} className={classes.join(' ')}>
              <span className="num">{Number(date.slice(8))}</span>
              {monthPlans
                .filter((p) => p.date === date && p.status === 'planned')
                .map((p) => {
                  const f = facilityById.get(p.facilityId);
                  return (
                    <span key={p.id} className="chip" style={{ background: f?.color }}>
                      {f?.name}
                    </span>
                  );
                })}
            </div>
          );
        })}
      </div>

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
      <form onSubmit={addOne} className="card">
        <div className="row">
          <div>
            <label htmlFor="plan-date">日付</label>
            <input id="plan-date" name="date" type="date" required defaultValue={month === monthOf(today) ? today : `${month}-01`} />
          </div>
          <div>
            <label htmlFor="plan-facility">デイ</label>
            <FacilitySelect id="plan-facility" />
          </div>
        </div>
        <div className="row">
          <div>
            <label htmlFor="plan-pickup">お迎え（学校など）</label>
            <input id="plan-pickup" name="pickupTime" type="time" />
          </div>
          <div>
            <label htmlFor="plan-return">帰宅</label>
            <input id="plan-return" name="returnTime" type="time" />
          </div>
        </div>
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
          <div className="row">
            {WEEKDAY_HEADERS.map((label, i) => (
              <label key={label} className="inline">
                <input type="checkbox" name="weekday" value={(i + 1) % 7} />
                {label}
              </label>
            ))}
          </div>
          <div className="row">
            <div>
              <label htmlFor="weekly-pickup">お迎え</label>
              <input id="weekly-pickup" name="pickupTime" type="time" />
            </div>
            <div>
              <label htmlFor="weekly-return">帰宅</label>
              <input id="weekly-return" name="returnTime" type="time" />
            </div>
          </div>
          <p className="muted">今日より前の日には追加しません。</p>
          <button type="submit">まとめて追加</button>
        </form>
      </details>

      <h2>この月の予定</h2>
      <div className="card">
        {monthPlans.length === 0 && <p className="muted">まだ予定がありません。</p>}
        <ul className="plan-list">
          {monthPlans.map((p) => {
            const f = facilityById.get(p.facilityId);
            const times = [
              shortTime(p.pickupTime) && `迎え ${shortTime(p.pickupTime)}`,
              shortTime(p.returnTime) && `帰宅 ${shortTime(p.returnTime)}`,
            ]
              .filter(Boolean)
              .join('・');
            return (
              <li key={p.id} className={p.status === 'cancelled' ? 'cancelled' : undefined}>
                <span className="what">
                  <span className="swatch" style={{ background: f?.color }} />
                  {formatJapaneseDate(p.date)} {f?.name}
                  {times && <span className="muted"> {times}</span>}
                  {p.note && <span className="muted">（{p.note}）</span>}
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
                  <button className="small danger" onClick={() => dispatch({ type: 'removePlan', id: p.id })}>
                    削除
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
