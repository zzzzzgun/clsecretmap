import type { Metadata } from 'next';
import Link from 'next/link';
import {
  addMonths,
  datesInMonth,
  formatJapaneseDate,
  isIsoMonth,
  lastDayOfMonth,
  monthOf,
  todayInTokyo,
  weekdayIndex,
} from '@/lib/domain/dates';
import {
  certificateAlert,
  findDoubleBookings,
  monthlyAllowance,
  shortTime,
} from '@/lib/domain/schedule';
import { PLAN_COLUMNS, toCertificate, toPlan, type CertificateRow, type FacilityRow, type PlanRow } from '@/lib/rows';
import { requireHousehold } from '@/lib/session';
import { addPlan, addWeeklyPlans, deletePlan, setPlanStatus } from './actions';

export const metadata: Metadata = { title: 'カレンダー' };

const WEEKDAY_HEADERS = ['月', '火', '水', '木', '金', '土', '日'];

export default async function CalendarPage({ searchParams }: PageProps<'/calendar'>) {
  const { supabase, child } = await requireHousehold();
  const today = todayInTokyo();
  const requested = (await searchParams).month;
  const month = typeof requested === 'string' && isIsoMonth(requested) ? requested : monthOf(today);

  const [facilitiesRes, plansRes, certificatesRes] = await Promise.all([
    supabase.from('facilities').select('id, name, color, archived').order('created_at').returns<FacilityRow[]>(),
    supabase
      .from('attendance_plans')
      .select(PLAN_COLUMNS)
      .eq('child_id', child.id)
      .gte('date', `${month}-01`)
      .lte('date', lastDayOfMonth(month))
      .order('date')
      .order('pickup_time')
      .returns<PlanRow[]>(),
    supabase
      .from('certificates')
      .select('valid_from, valid_until, monthly_days')
      .eq('child_id', child.id)
      .returns<CertificateRow[]>(),
  ]);
  if (facilitiesRes.error) throw facilitiesRes.error;
  if (plansRes.error) throw plansRes.error;
  if (certificatesRes.error) throw certificatesRes.error;

  const facilities = facilitiesRes.data;
  const activeFacilities = facilities.filter((f) => !f.archived);
  const facilityById = new Map(facilities.map((f) => [f.id, f]));
  const rows = plansRes.data;
  const plans = rows.map(toPlan);
  const certificates = certificatesRes.data.map(toCertificate);

  const allowance = monthlyAllowance(certificates, plans, month);
  const doubleBookings = findDoubleBookings(plans);
  const certAlert = certificateAlert(certificates, today);

  const dates = datesInMonth(month);
  const leadingBlanks = (weekdayIndex(dates[0]) + 6) % 7;
  const rowsByDate = Map.groupBy(rows, (r) => r.date);

  if (facilities.length === 0) {
    return (
      <>
        <h1>{child.display_name}さんのカレンダー</h1>
        <p className="notice info">
          まず<Link href="/settings">設定</Link>で、通っているデイを登録してください。
        </p>
      </>
    );
  }

  return (
    <>
      <h1>{child.display_name}さんのカレンダー</h1>

      {certAlert?.kind === 'missing' && (
        <p className="notice warn">
          受給者証が未登録です。<Link href="/settings">設定</Link>で登録すると、残りの日数がわかります。
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
        <Link href={`/calendar?month=${addMonths(month, -1)}`}>← 前の月</Link>
        <strong>{month.replace('-', '年')}月</strong>
        <Link href={`/calendar?month=${addMonths(month, 1)}`}>次の月 →</Link>
      </div>

      {allowance && (
        <p className={allowance.remaining < 0 ? 'notice danger' : 'notice info'}>
          この月の利用 {allowance.used}日 / 支給 {allowance.limit}日（
          {allowance.remaining >= 0 ? `残り${allowance.remaining}日` : `${-allowance.remaining}日オーバー`}）
        </p>
      )}

      <div className="calendar" role="grid" aria-label={`${month}の予定`}>
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
              {(rowsByDate.get(date) ?? [])
                .filter((p) => p.status === 'planned')
                .map((p) => {
                  const f = facilityById.get(p.facility_id);
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

      <h2>予定を追加</h2>
      <form action={addPlan} className="card">
        <div className="row">
          <div>
            <label htmlFor="date">日付</label>
            <input id="date" name="date" type="date" required defaultValue={month === monthOf(today) ? today : `${month}-01`} />
          </div>
          <div>
            <label htmlFor="facility_id">デイ</label>
            <select id="facility_id" name="facility_id" required>
              {activeFacilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label htmlFor="pickup_time">お迎え（学校など）</label>
            <input id="pickup_time" name="pickup_time" type="time" />
          </div>
          <div>
            <label htmlFor="return_time">帰宅</label>
            <input id="return_time" name="return_time" type="time" />
          </div>
        </div>
        <label htmlFor="note">メモ（共有されません）</label>
        <input id="note" name="note" type="text" maxLength={200} />
        <button type="submit">追加</button>
      </form>

      <details className="card">
        <summary>曜日でまとめて追加（{month.replace('-', '年')}月）</summary>
        <form action={addWeeklyPlans}>
          <input type="hidden" name="month" value={month} />
          <label htmlFor="weekly_facility">デイ</label>
          <select id="weekly_facility" name="facility_id" required>
            {activeFacilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
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
              <label htmlFor="weekly_pickup">お迎え</label>
              <input id="weekly_pickup" name="pickup_time" type="time" />
            </div>
            <div>
              <label htmlFor="weekly_return">帰宅</label>
              <input id="weekly_return" name="return_time" type="time" />
            </div>
          </div>
          <p className="muted">今日より前の日には追加しません。</p>
          <button type="submit">まとめて追加</button>
        </form>
      </details>

      <h2>この月の予定</h2>
      <div className="card">
        {rows.length === 0 && <p className="muted">まだ予定がありません。</p>}
        <ul className="plan-list">
          {rows.map((p) => {
            const f = facilityById.get(p.facility_id);
            const times = [shortTime(p.pickup_time) && `迎え ${shortTime(p.pickup_time)}`, shortTime(p.return_time) && `帰宅 ${shortTime(p.return_time)}`]
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
                <span className="row" style={{ flex: '0 0 auto' }}>
                  <form action={setPlanStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === 'planned' ? 'cancelled' : 'planned'} />
                    <button className="small secondary">{p.status === 'planned' ? 'お休み' : '戻す'}</button>
                  </form>
                  <form action={deletePlan}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="small danger">削除</button>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
