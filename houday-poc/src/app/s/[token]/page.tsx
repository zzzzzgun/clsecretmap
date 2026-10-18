import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { addDays, formatJapaneseDate, todayInTokyo } from '@/lib/domain/dates';
import { shortTime, weeklySchoolSchedule, type Plan } from '@/lib/domain/schedule';
import { sectionLabel } from '@/lib/domain/support-book';
import { createSupabaseAnonClient } from '@/lib/supabase/server';
import { formatUpdatedAt } from '@/lib/support-book-data';

export const metadata: Metadata = {
  title: '共有された情報',
  robots: { index: false, follow: false },
};

// 毎回 DB に問い合わせる（取り消し・期限切れをすぐ反映するため、キャッシュしない）
export const dynamic = 'force-dynamic';

interface SharedView {
  label: string;
  expires_at: string;
  child_name: string;
  schedule?: { date: string; facility: string; pickup_time: string | null; return_time: string | null }[];
  support_book: { section: string; body: string; updated_at: string }[];
}

const SCHEDULE_DAYS = 14;

export default async function SharedPage({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params;
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc('get_shared_view', { p_token: token });
  if (error) throw error;
  if (!data) notFound();
  const view = data as SharedView;

  // 共有用の予定を、日ごとの表に並べ直す（予定がない日は「デイなし」）
  const today = todayInTokyo();
  const facilities = [...new Set((view.schedule ?? []).map((s) => s.facility))].map((name) => ({ id: name, name }));
  const plans: Plan[] = (view.schedule ?? []).map((s, i) => ({
    id: String(i),
    childId: '',
    facilityId: s.facility,
    date: s.date,
    pickupTime: s.pickup_time,
    returnTime: s.return_time,
    status: 'planned',
  }));
  const days = weeklySchoolSchedule(plans, facilities, today, SCHEDULE_DAYS);

  return (
    <main>
      <h1>{view.child_name}さんの情報</h1>
      <p className="muted">
        {view.label} 向けに保護者が共有しています（{formatUpdatedAt(view.expires_at)}まで）。
        この内容を保護者の許可なく他の人に転送しないでください。
      </p>

      {view.schedule && (
        <>
          <h2>デイの予定（{formatJapaneseDate(today)}〜{formatJapaneseDate(addDays(today, SCHEDULE_DAYS - 1))}）</h2>
          <div className="card">
            <ul className="plan-list">
              {days.map((d) => (
                <li key={d.date}>
                  <span>{formatJapaneseDate(d.date)}</span>
                  <span>
                    {d.visits.length === 0
                      ? <span className="muted">デイなし</span>
                      : d.visits.map((v) => `${v.facilityName}${v.pickupTime ? `（迎え ${shortTime(v.pickupTime)}）` : ''}`).join('、')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {view.support_book.map((e) => (
        <section key={e.section} className="card">
          <h2 style={{ marginTop: 0 }}>{sectionLabel(e.section)}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{e.body}</p>
          <p className="muted">最終更新: {formatUpdatedAt(e.updated_at)}</p>
        </section>
      ))}

      <p className="muted">デイ手帳（試験運用中）</p>
    </main>
  );
}
