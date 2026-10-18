import type { Metadata } from 'next';
import Link from 'next/link';
import { requireHousehold } from '@/lib/session';
import { addCertificate, addFacility, deleteCertificate, setFacilityArchived, updateChild } from './actions';

export const metadata: Metadata = { title: '設定' };

export default async function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  const { supabase, child } = await requireHousehold();
  const { welcome } = await searchParams;

  const [{ data: facilities, error: fError }, { data: certificates, error: cError }] = await Promise.all([
    supabase.from('facilities').select('id, name, color, archived').order('created_at'),
    supabase
      .from('certificates')
      .select('id, valid_from, valid_until, monthly_days')
      .eq('child_id', child.id)
      .order('valid_from', { ascending: false }),
  ]);
  if (fError) throw fError;
  if (cError) throw cError;

  return (
    <>
      <h1>設定</h1>
      {welcome && (
        <p className="notice info">
          登録しました。まず、通っているデイと受給者証を登録してください。終わったら
          <Link href="/calendar">カレンダー</Link>で利用日を入れられます。
        </p>
      )}

      <h2>通っているデイ</h2>
      <div className="card">
        {facilities.length === 0 && <p className="muted">まだ登録されていません。</p>}
        <ul className="plan-list">
          {facilities.map((f) => (
            <li key={f.id} className={f.archived ? 'cancelled' : undefined}>
              <span className="what">
                <span className="swatch" style={{ background: f.color }} />
                {f.name}
                {f.archived && '（通っていない）'}
              </span>
              <form action={setFacilityArchived}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="archived" value={String(!f.archived)} />
                <button className="small secondary">{f.archived ? '戻す' : 'やめた'}</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addFacility}>
          <label htmlFor="facility_name">デイを追加</label>
          <input id="facility_name" name="name" type="text" maxLength={80} required placeholder="例: ひまわり放課後デイ" />
          <button type="submit">追加</button>
        </form>
      </div>

      <h2>受給者証</h2>
      <div className="card">
        <p className="muted">支給日数（1か月に使える日数）と有効期間を入れると、残りの日数と更新時期をお知らせします。</p>
        <ul className="plan-list">
          {certificates.map((c) => (
            <li key={c.id}>
              <span className="what">
                {c.valid_from} 〜 {c.valid_until}・月{c.monthly_days}日
              </span>
              <form action={deleteCertificate}>
                <input type="hidden" name="id" value={c.id} />
                <button className="small danger">削除</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addCertificate}>
          <div className="row">
            <div>
              <label htmlFor="valid_from">有効期間（から）</label>
              <input id="valid_from" name="valid_from" type="date" required />
            </div>
            <div>
              <label htmlFor="valid_until">有効期間（まで）</label>
              <input id="valid_until" name="valid_until" type="date" required />
            </div>
            <div>
              <label htmlFor="monthly_days">支給日数（日/月）</label>
              <input id="monthly_days" name="monthly_days" type="number" min={1} max={31} required />
            </div>
          </div>
          <button type="submit">受給者証を登録</button>
        </form>
      </div>

      <h2>お子さん</h2>
      <form action={updateChild} className="card">
        <label htmlFor="display_name">呼び名</label>
        <input id="display_name" name="display_name" type="text" maxLength={40} required defaultValue={child.display_name} />
        <div className="row">
          <div>
            <label htmlFor="school_name">学校</label>
            <input id="school_name" name="school_name" type="text" maxLength={80} defaultValue={child.school_name ?? ''} />
          </div>
          <div>
            <label htmlFor="school_grade">学年</label>
            <input id="school_grade" name="school_grade" type="text" maxLength={20} defaultValue={child.school_grade ?? ''} placeholder="例: 小3" />
          </div>
        </div>
        <button type="submit">保存</button>
      </form>

      <p className="muted">
        <Link href="/privacy">プライバシーポリシー</Link>
      </p>
    </>
  );
}
