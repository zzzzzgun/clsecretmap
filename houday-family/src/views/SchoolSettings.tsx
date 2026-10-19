import { type FormEvent } from 'react';
import { field } from '../components';
import { PERIOD_OPTIONS, type Child, type Facility } from '../model';
import { newId, useStore } from '../store';

const WEEKDAYS = [
  { key: '1', label: '月' },
  { key: '2', label: '火' },
  { key: '3', label: '水' },
  { key: '4', label: '木' },
  { key: '5', label: '金' },
];

/** 下校時刻と曜日ごとの授業時間。平日の「学校お迎え」の時刻に使う */
export function SchoolTimesForm({ child }: { child: Child }) {
  const { dispatch } = useStore();

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dismissal: Record<string, string> = {};
    for (const p of PERIOD_OPTIONS) {
      const t = field(form, `dismissal-${p}`);
      if (t) dismissal[String(p)] = t;
    }
    const weeklyPeriods: Record<string, number> = {};
    for (const d of WEEKDAYS) {
      const v = Number(field(form, `periods-${d.key}`));
      if (v) weeklyPeriods[d.key] = v;
    }
    dispatch({ type: 'updateChild', child: { ...child, dismissal, weeklyPeriods } });
  }

  return (
    <form key={child.id} onSubmit={save} className="card">
      <p className="muted">
        平日は学校からデイへ行くので、お迎えの時刻は「その日が何時間授業か」で決まります。ここに入れておくと、予定を入れるときに下校時刻が自動で入ります。
      </p>
      <label>授業の時間数ごとの下校時刻</label>
      <div className="period-grid">
        {PERIOD_OPTIONS.map((p) => (
          <label key={p} className="period-cell">
            <span>{p}時間</span>
            <input type="time" name={`dismissal-${p}`} defaultValue={child.dismissal?.[String(p)] ?? ''} />
          </label>
        ))}
      </div>
      <label>曜日ごとの、ふだんの授業の時間数</label>
      <div className="weekday-periods">
        {WEEKDAYS.map((d) => (
          <label key={d.key}>
            <span>{d.label}</span>
            <select name={`periods-${d.key}`} defaultValue={String(child.weeklyPeriods?.[d.key] ?? '')}>
              <option value="">—</option>
              {PERIOD_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="muted">行事などで時間数が違う日は、カレンダーの「この月の予定」にある「時刻」で1日ずつ直せます。</p>
      <div className="actions">
        <button type="submit">保存</button>
      </div>
    </form>
  );
}

/** 夏休みなど、平日でも学校がない期間 */
export function SchoolBreaksForm({ child }: { child: Child }) {
  const { dispatch } = useStore();
  const breaks = [...(child.schoolBreaks ?? [])].sort((a, b) => a.from.localeCompare(b.from));

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const from = field(form, 'from');
    const until = field(form, 'until');
    if (until < from) {
      window.alert('期間の終わりが始まりより前になっています。');
      return;
    }
    const label = field(form, 'label') || '学校休み';
    dispatch({
      type: 'updateChild',
      child: { ...child, schoolBreaks: [...(child.schoolBreaks ?? []), { id: newId(), label, from, until }] },
    });
    e.currentTarget.reset();
  }

  function remove(id: string) {
    dispatch({ type: 'updateChild', child: { ...child, schoolBreaks: (child.schoolBreaks ?? []).filter((b) => b.id !== id) } });
  }

  return (
    <div className="card">
      <p className="muted">夏休み・冬休み・春休みなど、平日でも学校がない期間です。この期間は家からデイへ行く扱いになります。</p>
      <ul className="plan-list">
        {breaks.map((b) => (
          <li key={b.id}>
            <span className="what">
              <strong>{b.label}</strong>
              <span className="sub">
                {b.from} 〜 {b.until}
              </span>
            </span>
            <button className="small danger" onClick={() => remove(b.id)}>
              削除
            </button>
          </li>
        ))}
      </ul>
      <form key={child.id} onSubmit={add}>
        <label htmlFor="break-label">期間の名前</label>
        <input id="break-label" name="label" type="text" maxLength={20} placeholder="例: 冬休み" />
        <div className="row">
          <div>
            <label htmlFor="break-from">から</label>
            <input id="break-from" name="from" type="date" required />
          </div>
          <div>
            <label htmlFor="break-until">まで</label>
            <input id="break-until" name="until" type="date" required />
          </div>
        </div>
        <button type="submit">期間を追加</button>
      </form>
    </div>
  );
}

/** デイごとの、いつものお迎え・帰宅の時刻 */
export function FacilityTimesForm({ facility }: { facility: Facility }) {
  const { dispatch } = useStore();
  const configured = facility.weekdayReturn || facility.homePickup || facility.homeReturn || facility.hours;

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    dispatch({
      type: 'updateFacilityTimes',
      id: facility.id,
      times: {
        weekdayReturn: field(form, 'weekdayReturn') || null,
        homePickup: field(form, 'homePickup') || null,
        homeReturn: field(form, 'homeReturn') || null,
        openOnHolidays: form.get('openOnHolidays') !== 'no',
        closedWeekdays: form.getAll('closedWeekday').map(Number),
        hours: {
          school: { open: field(form, 'schoolOpen') || null, close: field(form, 'schoolClose') || null },
          home: { open: field(form, 'homeOpen') || null, close: field(form, 'homeClose') || null },
        },
      },
    });
    (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
  }

  return (
    <details className="facility-times">
      <summary className="muted">
        時刻・営業日{configured ? '' : '（未設定）'}
        {facility.openOnHolidays === false && '　祝日休み'}
        {facility.closedWeekdays && facility.closedWeekdays.length > 0 &&
          `　定休 ${facility.closedWeekdays.map((d) => '日月火水木金土'[d]).join('・')}`}
        {facility.weekdayReturn && `　平日 帰宅 ${facility.weekdayReturn}`}
        {(facility.homePickup || facility.homeReturn) &&
          `　休日 ${facility.homePickup ? `迎え ${facility.homePickup}` : ''}${facility.homeReturn ? ` 帰宅 ${facility.homeReturn}` : ''}`}
      </summary>
      <form onSubmit={save}>
        <label>平日（学校から）</label>
        <div className="row">
          <div>
            <label htmlFor={`wr-${facility.id}`} className="sublabel">
              帰宅
            </label>
            <input id={`wr-${facility.id}`} name="weekdayReturn" type="time" defaultValue={facility.weekdayReturn ?? ''} />
          </div>
          <div />
        </div>
        <label>土日・祝日・学校が休みの日（家から）</label>
        <div className="row">
          <div>
            <label htmlFor={`hp-${facility.id}`} className="sublabel">
              お迎え
            </label>
            <input id={`hp-${facility.id}`} name="homePickup" type="time" defaultValue={facility.homePickup ?? ''} />
          </div>
          <div>
            <label htmlFor={`hr-${facility.id}`} className="sublabel">
              帰宅
            </label>
            <input id={`hr-${facility.id}`} name="homeReturn" type="time" defaultValue={facility.homeReturn ?? ''} />
          </div>
        </div>
        <label>営業時間（平日）</label>
        <div className="row">
          <div>
            <label className="sublabel">開始</label>
            <input aria-label="平日の開始" name="schoolOpen" type="time" defaultValue={facility.hours?.school?.open ?? ''} />
          </div>
          <div>
            <label className="sublabel">終了</label>
            <input aria-label="平日の終了" name="schoolClose" type="time" defaultValue={facility.hours?.school?.close ?? ''} />
          </div>
        </div>
        <label>営業時間（土日・祝日・学校が休みの日）</label>
        <div className="row">
          <div>
            <label className="sublabel">開始</label>
            <input aria-label="休日の開始" name="homeOpen" type="time" defaultValue={facility.hours?.home?.open ?? ''} />
          </div>
          <div>
            <label className="sublabel">終了</label>
            <input aria-label="休日の終了" name="homeClose" type="time" defaultValue={facility.hours?.home?.close ?? ''} />
          </div>
        </div>
        <label>祝日</label>
        <div className="row">
          <label className="inline">
            <input type="radio" name="openOnHolidays" value="yes" defaultChecked={facility.openOnHolidays !== false} />
            営業している
          </label>
          <label className="inline">
            <input type="radio" name="openOnHolidays" value="no" defaultChecked={facility.openOnHolidays === false} />
            休み
          </label>
        </div>
        <label>定休日</label>
        <div className="weekdays">
          {['月', '火', '水', '木', '金', '土', '日'].map((label, i) => (
            <label key={label}>
              <input
                type="checkbox"
                name="closedWeekday"
                value={(i + 1) % 7}
                defaultChecked={facility.closedWeekdays?.includes((i + 1) % 7)}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="actions">
          <button type="submit">保存</button>
        </div>
      </form>
    </details>
  );
}

