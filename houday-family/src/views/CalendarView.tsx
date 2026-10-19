import { addMonths, datesInMonth, monthOf, todayInTokyo, weekdayIndex } from '@domain/dates';
import { formatDateWithHoliday, holidayName, holidaysInMonth } from '@domain/holidays';
import { certificateAlert, findDoubleBookings, monthlyAllowance } from '@domain/schedule';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FacilitySelect, field } from '../components';
import {
  dayKindNote,
  defaultPlanTimes,
  facilityClosedReason,
  outsideHoursWarning,
  pickupFromOf,
  planTimesText,
  type PlanTimes,
} from '../dayType';
import { facilitiesForChild, type Child, type PlanEntry } from '../model';
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
  const activeFacilities = facilitiesForChild(state.facilities, child.id).filter((f) => !f.archived);
  const [viewAll, setViewAll] = useState(false);
  const showAll = viewAll && state.children.length > 1;
  const shownChildren = showAll ? state.children : [child];
  const childById = new Map(state.children.map((c) => [c.id, c]));
  const [addDate, setAddDate] = useState<string | null>(null);
  const [addFacilityId, setAddFacilityId] = useState<string | null>(null);
  const [addTimes, setAddTimes] = useState<PlanTimes | null>(null);
  const [weeklyNotice, setWeeklyNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  function changeMonth(delta: number) {
    setMonth(addMonths(month, delta));
    setAddDate(null);
    setAddTimes(null);
    setWeeklyNotice(null);
  }

  const facilityById = new Map(state.facilities.map((f) => [f.id, f]));
  const shownIds = new Set(shownChildren.map((c) => c.id));
  const monthPlans = state.plans
    .filter((p) => shownIds.has(p.childId))
    .filter((p) => monthOf(p.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.pickupTime ?? '').localeCompare(b.pickupTime ?? ''));
  const certificates = state.certificates.filter((c) => c.childId === child.id);

  // 残り日数と重複は子どもごとに数える（受給者証は一人ずつ）
  const summaries = shownChildren.map((c) => {
    const plans = monthPlans.filter((p) => p.childId === c.id);
    return {
      child: c,
      allowance: monthlyAllowance(
        state.certificates.filter((x) => x.childId === c.id),
        state.plans.filter((p) => p.childId === c.id),
        month,
      ),
      doubleBookings: findDoubleBookings(plans),
    };
  });
  const conflictDates = new Set(summaries.flatMap((x) => [...x.doubleBookings.keys()]));
  const certAlert = certificateAlert(certificates, today);

  const dates = datesInMonth(month);
  const holidays = holidaysInMonth(month);
  const currentAddDate = addDate ?? defaultAddDate;
  const currentFacilityId = addFacilityId && activeFacilities.some((f) => f.id === addFacilityId) ? addFacilityId : activeFacilities[0]?.id ?? '';
  const currentFacility = state.facilities.find((f) => f.id === currentFacilityId);
  // 日付やデイを変えたら、その日のふだんどおりの時刻を入れ直す
  const currentTimes = addTimes ?? defaultPlanTimes(child, currentFacility, currentAddDate);
  const addDateHoliday = holidayName(currentAddDate);
  const addClosed = facilityClosedReason(currentFacility, currentAddDate);
  const addHoursWarning = outsideHoursWarning(currentFacility, currentTimes);
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
    // デイが休みの日（祝日休み・定休日）は入れない
    const closed = candidates.filter((d) => !skipped.includes(d) && facilityClosedReason(facility, d));
    const plans: PlanEntry[] = candidates
      .filter((d) => !skipped.includes(d) && !closed.includes(d))
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
      [
        `${plans.length}日分を追加しました。`,
        skipped.length > 0 &&
          `祝日の ${skipped.map(formatDateWithHoliday).join('、')} は入れていません。必要なら「予定を追加」で1日ずつ入れてください。`,
        closed.length > 0 &&
          `${facility?.name}が休みの ${closed.map((d) => `${formatDateWithHoliday(d)}（${facilityClosedReason(facility, d)}）`).join('、')} は入れていません。`,
      ]
        .filter(Boolean)
        .join(''),
    );
    e.currentTarget.reset();
  }

  function renderPlanItem(p: PlanEntry) {
  const f = facilityById.get(p.facilityId);
  const planChild = childById.get(p.childId) ?? child;
  const times = planTimesText(planChild, p);
  const warning =
    p.status === 'planned'
      ? facilityClosedReason(f, p.date) ?? outsideHoursWarning(f, { ...p, pickupFrom: pickupFromOf(planChild, p) })
      : null;
  return (
    <li key={p.id} className={p.status === 'cancelled' ? 'cancelled' : undefined}>
      <span className="what">
        <span className="swatch" style={{ background: f?.color }} />
        <strong className={holidayName(p.date) ? 'holiday-text' : undefined}>{formatDateWithHoliday(p.date)}</strong>{' '}
        {showAll && <span className="who">{planChild.name}さん</span>}
        {f?.name}
        {holidayName(p.date) && <span className="sub holiday-text">{holidayName(p.date)}</span>}
        {times && <span className="sub">{times}</span>}
        {p.note && <span className="sub">メモ: {p.note}</span>}
        {warning && <span className="sub warn-text">⚠ {warning}</span>}
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
      {editingId === p.id && <PlanEditForm child={planChild} plan={p} onDone={() => setEditingId(null)} />}
    </li>
  );
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

      {conflictDates.size > 0 && (
        <div className="notice danger">
          同じ日に2か所のデイが入っています。受給者証で使えるのは1日1か所までで、2か所目は全額自己負担になることがあります。
          <ul>
            {summaries.flatMap((x) =>
              [...x.doubleBookings.entries()].map(([date, ids]) => (
                <li key={`${x.child.id}-${date}`}>
                  {showAll && `${x.child.name}さん `}
                  {formatDateWithHoliday(date)}: {ids.map((id) => facilityById.get(id)?.name).join('、')}
                </li>
              )),
            )}
          </ul>
        </div>
      )}

      {state.children.length > 1 && (
        <div className="segmented view-toggle" role="radiogroup" aria-label="表示する子ども">
          <label className={!showAll ? 'on' : undefined}>
            <input type="radio" name="calendar-view" checked={!showAll} onChange={() => setViewAll(false)} />
            {child.name}さん
          </label>
          <label className={showAll ? 'on' : undefined}>
            <input type="radio" name="calendar-view" checked={showAll} onChange={() => setViewAll(true)} />
            全員
          </label>
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

      {summaries.map(
        ({ child: c, allowance }) =>
          allowance && (
            <p key={c.id} className={allowance.remaining < 0 ? 'notice danger' : 'notice info'}>
              {showAll && `${c.name}さん：`}利用 {allowance.used}日 / 支給 {allowance.limit}日（
              {allowance.remaining >= 0 ? `残り${allowance.remaining}日` : `${-allowance.remaining}日オーバー`}）
            </p>
          ),
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
            conflictDates.has(date) && 'conflict',
          ].filter(Boolean);
          return (
            <button
              type="button"
              key={date}
              className={classes.join(' ')}
              title={holiday ?? undefined}
              aria-label={`${formatDateWithHoliday(date)}の予定を見る`}
              onClick={() => setOpenDate(date)}
            >
              <span className="num">{Number(date.slice(8))}</span>
              {holiday && <span className="holiday-mark">祝</span>}
              {monthPlans
                .filter((p) => p.date === date && p.status === 'planned')
                .map((p) => {
                  const f = facilityById.get(p.facilityId);
                  const who = childById.get(p.childId)?.name ?? '';
                  return (
                    // マスが狭いので頭の2文字だけ（全員表示では子どもの名前の頭1文字＋デイの頭1文字）。どのデイかは色と下の凡例で分かる
                    <span key={p.id} className="chip" style={{ background: f?.color }} title={showAll ? `${who}：${f?.name}` : f?.name}>
                      {showAll
                        ? `${Array.from(who)[0] ?? ''}${Array.from(f?.name ?? '')[0] ?? ''}`
                        : Array.from(f?.name ?? '').slice(0, 2).join('')}
                    </span>
                  );
                })}
            </button>
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
          .filter((f) => !f.archived && shownChildren.some((c) => !f.childIds || f.childIds.includes(c.id)))
          .map((f) => (
            <span key={f.id}>
              <span className="swatch" style={{ background: f.color }} />
              {f.name}
            </span>
          ))}
      </p>

      <h2>予定を追加{state.children.length > 1 && `（${child.name}さん）`}</h2>
      {missingSchoolTimes && (
        <p className="notice info">
          <button className="link" onClick={() => goTo('settings')}>設定</button>で下校時刻とデイのいつもの時刻を入れておくと、お迎え・帰宅の時刻が自動で入ります。
        </p>
      )}
      <form onSubmit={addOne} className="card" ref={addFormRef}>
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
        {addClosed && (
          <p className="notice danger">
            {currentFacility?.name}はこの日は休みです（{addClosed}）。
          </p>
        )}
        {addHoursWarning && <p className="notice warn">{addHoursWarning}。</p>}
        {addDateHoliday && !addClosed && (
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
          <FacilitySelect id="weekly-facility" childId={child.id} />
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
            お迎え・帰宅の時刻は、平日は下校時刻（曜日ごとの授業時間）、土日・祝日・学校が休みの期間は「家から」の時刻で自動で入ります。違う日は、カレンダーの日付をタップして「時刻」で直せます。
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

      {openDate && (
        <DayModal
          date={openDate}
          title={`${formatDateWithHoliday(openDate)}${holidayName(openDate) ? ` ${holidayName(openDate)}` : ''}`}
          note={dayKindNote(child, openDate)}
          onClose={() => setOpenDate(null)}
          onAdd={() => {
            setAddDate(openDate);
            setAddTimes(null);
            setOpenDate(null);
            setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
          }}
          addLabel={`この日に予定を追加${state.children.length > 1 ? `（${child.name}さん）` : ''}`}
        >
          {monthPlans.filter((p) => p.date === openDate).length === 0 ? (
            <p className="muted">この日の予定はありません。</p>
          ) : (
            <ul className="plan-list">{monthPlans.filter((p) => p.date === openDate).map(renderPlanItem)}</ul>
          )}
        </DayModal>
      )}
    </>
  );
}

function DayModal({
  title,
  note,
  addLabel,
  onClose,
  onAdd,
  children,
}: {
  date: string;
  title: string;
  note: string;
  addLabel: string;
  onClose: () => void;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  // Esc キーで閉じる・後ろの画面がスクロールしないようにする
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{title}</strong>
          <button type="button" className="small secondary" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        <p className="day-note">{note}</p>
        {children}
        <button type="button" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}
