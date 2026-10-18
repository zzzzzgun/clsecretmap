import type { Metadata } from 'next';
import { sectionLabel } from '@/lib/domain/support-book';
import { requireHousehold } from '@/lib/session';
import { formatUpdatedAt } from '@/lib/support-book-data';
import { revokeShareLink } from './actions';
import { CreateShareForm } from './create-share-form';

export const metadata: Metadata = { title: '共有' };

interface ShareLinkRow {
  id: string;
  label: string;
  scopes: string[];
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  share_link_views: { count: number }[];
}

function scopeLabel(scope: string): string {
  return scope === 'schedule' ? '予定' : sectionLabel(scope.slice(3));
}

export default async function SharePage() {
  const { supabase, child } = await requireHousehold();
  const { data: links, error } = await supabase
    .from('share_links')
    .select('id, label, scopes, expires_at, revoked_at, created_at, share_link_views(count)')
    .eq('child_id', child.id)
    .order('created_at', { ascending: false })
    .returns<ShareLinkRow[]>();
  if (error) throw error;

  const now = new Date().toISOString();

  return (
    <>
      <h1>学校・デイへの共有</h1>
      <p className="muted">
        相手はアプリを入れなくても、リンクを開くだけで見られます。共有するのは選んだ項目だけで、いつでも取り消せます。
      </p>

      <CreateShareForm />

      <h2>作った共有リンク</h2>
      <div className="card">
        {links.length === 0 && <p className="muted">まだありません。</p>}
        <ul className="plan-list">
          {links.map((l) => {
            const active = !l.revoked_at && l.expires_at > now;
            const views = l.share_link_views[0]?.count ?? 0;
            return (
              <li key={l.id} className={active ? undefined : 'cancelled'}>
                <span className="what">
                  <strong>{l.label}</strong>
                  <br />
                  <span className="muted">
                    {l.scopes.map(scopeLabel).join('・')} / 閲覧{views}回 /{' '}
                    {l.revoked_at ? '取り消し済み' : active ? `${formatUpdatedAt(l.expires_at)}まで` : '期限切れ'}
                  </span>
                </span>
                {active && (
                  <form action={revokeShareLink}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="small danger">取り消す</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
