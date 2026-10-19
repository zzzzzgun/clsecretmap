import { useState, type FormEvent } from 'react';
import { pickupFromOf, timesFor, type PlanTimes } from '../dayType';
import { PERIOD_OPTIONS, type Child, type PlanEntry } from '../model';
import { useStore } from '../store';

/** お迎えの場所・授業の時間数・時刻の入力欄（追加と変更で共通） */
export function TimesFields({
  idPrefix,
  child,
  facilityId,
  date,
  value,
  onChange,
}: {
  idPrefix: string;
  child: Child;
  facilityId: string;
  date: string;
  value: PlanTimes;
  onChange: (v: PlanTimes) => void;
}) {
  const { state } = useStore();
  const facility = state.facilities.find((f) => f.id === facilityId);

  return (
    <>
      <label>お迎えの場所</label>
      <div className="segmented" role="radiogroup">
        {(['school', 'home'] as const).map((from) => (
          <label key={from} className={value.pickupFrom === from ? 'on' : undefined}>
            <input
              type="radio"
              name={`${idPrefix}-from`}
              checked={value.pickupFrom === from}
              onChange={() => onChange(timesFor(child, facility, date, from))}
            />
            {from === 'school' ? '学校から' : '家から'}
          </label>
        ))}
      </div>
      {value.pickupFrom === 'school' && (
        <>
          <label htmlFor={`${idPrefix}-periods`}>この日の授業</label>
          <select
            id={`${idPrefix}-periods`}
            value={value.periods ?? ''}
            onChange={(e) => {
              const periods = e.target.value ? Number(e.target.value) : null;
              onChange({ ...timesFor(child, facility, date, 'school', periods), returnTime: value.returnTime });
            }}
          >
            <option value="">わからない・その他</option>
            {PERIOD_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}時間授業{child.dismissal?.[String(p)] ? `（下校 ${child.dismissal[String(p)]}）` : ''}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="row">
        <div>
          <label htmlFor={`${idPrefix}-pickup`}>{value.pickupFrom === 'school' ? 'お迎え（下校）' : 'お迎え（家）'}</label>
          <input
            id={`${idPrefix}-pickup`}
            type="time"
            value={value.pickupTime ?? ''}
            onChange={(e) => onChange({ ...value, pickupTime: e.target.value || null })}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-return`}>帰宅</label>
          <input
            id={`${idPrefix}-return`}
            type="time"
            value={value.returnTime ?? ''}
            onChange={(e) => onChange({ ...value, returnTime: e.target.value || null })}
          />
        </div>
      </div>
    </>
  );
}

/** 登録済みの予定の、お迎え・帰宅を変える（短縮授業の日など） */
export function PlanEditForm({ child, plan, onDone }: { child: Child; plan: PlanEntry; onDone: () => void }) {
  const { dispatch } = useStore();
  const [value, setValue] = useState<PlanTimes>({
    pickupFrom: pickupFromOf(child, plan),
    periods: plan.periods ?? null,
    pickupTime: plan.pickupTime ? plan.pickupTime.slice(0, 5) : null,
    returnTime: plan.returnTime ? plan.returnTime.slice(0, 5) : null,
  });

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    dispatch({ type: 'updatePlanTimes', id: plan.id, times: value });
    onDone();
  }

  return (
    <form onSubmit={save} className="plan-edit">
      <TimesFields idPrefix={`edit-${plan.id}`} child={child} facilityId={plan.facilityId} date={plan.date} value={value} onChange={setValue} />
      <div className="actions">
        <button type="submit" className="small">
          保存
        </button>
        <button type="button" className="small secondary" onClick={onDone}>
          やめる
        </button>
      </div>
    </form>
  );
}
