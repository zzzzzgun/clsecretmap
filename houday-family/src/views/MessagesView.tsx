import { addDays, addMonths, mondayOf, monthOf, todayInTokyo, weekdayIndex } from '@domain/dates';
import { weeklySchoolSchedule } from '@domain/schedule';
import { useState } from 'react';
import { CopyButton } from '../components';
import { requestMessage, schoolDayLine, schoolWeekMessage } from '../messages';
import type { Child } from '../model';
import { useStore } from '../store';

function monthDay(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
}

function monthTitle(month: string) {
  return `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
}

export function MessagesView({ child }: { child: Child }) {
  const { state } = useStore();
  const today = todayInTokyo();
  const thisMonday = mondayOf(today);
  // 土日に開いたときは、もう終わった今週ではなく来週を見せる
  const isWeekend = [0, 6].includes(weekdayIndex(today));
  const [weekStart, setWeekStart] = useState(isWeekend ? addDays(thisMonday, 7) : thisMonday);
  const [requestMonth, setRequestMonth] = useState(addMonths(monthOf(today), 1));

  const plans = state.plans.filter((p) => p.childId === child.id);
  const days = weeklySchoolSchedule(plans, state.facilities, weekStart, 5);
  const schoolText = schoolWeekMessage({ child, days });

  const activeFacilities = state.facilities.filter((f) => !f.archived);

  return (
    <>
      <h2>学校へ：週のデイの予定</h2>
      <div className="card">
        <div className="month-nav">
          <button className="small secondary" aria-label="前の週" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← 前
          </button>
          <strong>
            {monthDay(weekStart)}〜{monthDay(addDays(weekStart, 4))}
            {weekStart === thisMonday && '（今週）'}
            {weekStart === addDays(thisMonday, 7) && '（来週）'}
          </strong>
          <button className="small secondary" aria-label="次の週" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            次 →
          </button>
        </div>
        <table className="week-table">
          <tbody>
            {days.map((d) => {
              const line = schoolDayLine(child, d);
              return (
                <tr key={d.date} className={line.noSchool ? 'holiday' : undefined}>
                  <th>{line.dateLabel}</th>
                  <td>
                    {line.noSchool && <strong>{line.noSchool}</strong>}
                    {line.noSchool && line.visits && <br />}
                    {line.visits || (!line.noSchool && 'デイなし')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted no-print">連絡帳に貼るなら印刷、担任の先生に送るならコピーしてください。</p>
        <div className="actions no-print">
          <CopyButton text={schoolText} label="文面をコピー" />
          <button type="button" className="small secondary" onClick={() => window.print()}>
            印刷
          </button>
        </div>
      </div>

      <div className="no-print">
        <h2>デイへ：利用希望日の連絡</h2>
        <div className="card">
          <div className="month-nav">
            <button className="small secondary" aria-label="前の月" onClick={() => setRequestMonth(addMonths(requestMonth, -1))}>
              ← 前
            </button>
            <strong>{monthTitle(requestMonth)}</strong>
            <button className="small secondary" aria-label="次の月" onClick={() => setRequestMonth(addMonths(requestMonth, 1))}>
              次 →
            </button>
          </div>
          <p className="muted">カレンダーに入れた予定から、デイごとの文面を作ります。LINE やメールに貼って送ってください。</p>
        </div>
        {activeFacilities.map((f) => {
          const text = requestMessage({
            child,
            facilityName: f.name,
            month: requestMonth,
            plans: plans.filter((p) => p.facilityId === f.id),
          });
          return (
            <div key={f.id} className="card">
              <strong>
                <span className="swatch" style={{ background: f.color }} />
                {f.name}
              </strong>
              <p className="message-preview">{text}</p>
              <CopyButton text={text} label="文面をコピー" />
            </div>
          );
        })}
      </div>
    </>
  );
}
