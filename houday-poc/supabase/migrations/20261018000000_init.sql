-- 放デイ保護者アプリ PoC: 初期スキーマ
--
-- 方針
-- * 全てのデータは「家庭（household）」に属し、その家庭のメンバーだけが読み書きできる（RLS）。
-- * 子ども・事業所を参照する行は (id, household_id) の複合外部キーで結び、
--   別の家庭の子どもや事業所を指す行を作れないようにする。
-- * 共有リンクはトークンのハッシュだけを保存し、閲覧は get_shared_view() 経由に限る。

-- ---------------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

-- 要配慮個人情報の取得に対する同意の記録
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_version text not null check (char_length(policy_version) between 1 and 20),
  agreed_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  school_name text check (char_length(school_name) <= 80),
  school_grade text check (char_length(school_grade) <= 20),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

-- 通っているデイ（家庭ごとに登録する。事業所側のアカウントは持たない）
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#4f7cff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

-- 通所受給者証（支給日数と有効期間）
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  child_id uuid not null,
  valid_from date not null,
  valid_until date not null,
  monthly_days integer not null check (monthly_days between 1 and 31),
  created_at timestamptz not null default now(),
  check (valid_until >= valid_from),
  foreign key (child_id, household_id) references public.children (id, household_id) on delete cascade
);

create index certificates_child_id_idx on public.certificates (child_id, valid_until);

-- 利用予定（1日に複数の行を作れる。重複はアプリ側で警告する）
create table public.attendance_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  child_id uuid not null,
  facility_id uuid not null,
  date date not null,
  pickup_time time,
  return_time time,
  status text not null default 'planned' check (status in ('planned', 'cancelled')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  foreign key (child_id, household_id) references public.children (id, household_id) on delete cascade,
  foreign key (facility_id, household_id) references public.facilities (id, household_id) on delete cascade
);

create index attendance_plans_child_date_idx on public.attendance_plans (child_id, date);

-- サポートブック（項目ごとに1行）
create table public.support_book_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  child_id uuid not null,
  section text not null check (
    section in ('basic', 'communication', 'likes', 'difficulties', 'calming', 'daily', 'medical')
  ),
  body text not null default '' check (char_length(body) <= 4000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  unique (child_id, section),
  foreign key (child_id, household_id) references public.children (id, household_id) on delete cascade
);

-- サポートブックの更新履歴（トリガーだけが書き込む）
create table public.support_book_revisions (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.support_book_entries (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  section text not null,
  body text not null,
  revised_at timestamptz not null,
  revised_by uuid
);

create index support_book_revisions_entry_idx on public.support_book_revisions (entry_id, revised_at desc);

-- 共有リンク（学校の先生・デイのスタッフなどアプリを持たない人向け）
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  child_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (char_length(label) between 1 and 60),
  scopes text[] not null check (
    cardinality(scopes) > 0
    and scopes <@ array[
      'schedule',
      'sb:basic', 'sb:communication', 'sb:likes', 'sb:difficulties',
      'sb:calming', 'sb:daily', 'sb:medical'
    ]
  ),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '366 days'),
  foreign key (child_id, household_id) references public.children (id, household_id) on delete cascade
);

-- 共有リンクの閲覧履歴（get_shared_view() だけが書き込む）
create table public.share_link_views (
  id bigint generated always as identity primary key,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index share_link_views_link_idx on public.share_link_views (share_link_id, viewed_at desc);

-- ---------------------------------------------------------------------------
-- 権限
-- ---------------------------------------------------------------------------

create function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- 未ログインの利用者はテーブルに一切触れない（共有ページは get_shared_view() 経由）
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.households, public.household_members to authenticated;
grant select, insert on public.consents to authenticated;
grant select, insert, update, delete on
  public.children,
  public.facilities,
  public.certificates,
  public.attendance_plans,
  public.support_book_entries
to authenticated;
grant select on public.support_book_revisions, public.share_link_views to authenticated;
grant select, insert, delete on public.share_links to authenticated;
-- 作成後に変えられるのは取り消し日時とラベルだけ
grant update (revoked_at, label) on public.share_links to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.consents enable row level security;
alter table public.children enable row level security;
alter table public.facilities enable row level security;
alter table public.certificates enable row level security;
alter table public.attendance_plans enable row level security;
alter table public.support_book_entries enable row level security;
alter table public.support_book_revisions enable row level security;
alter table public.share_links enable row level security;
alter table public.share_link_views enable row level security;

create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

create policy consents_select on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy consents_insert on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy children_all on public.children
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy facilities_all on public.facilities
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy certificates_all on public.certificates
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy attendance_plans_all on public.attendance_plans
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy support_book_entries_all on public.support_book_entries
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy support_book_revisions_select on public.support_book_revisions
  for select to authenticated
  using (public.is_household_member(household_id));

create policy share_links_all on public.share_links
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy share_link_views_select on public.share_link_views
  for select to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- サポートブックの更新履歴
-- ---------------------------------------------------------------------------

create function public.record_support_book_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    insert into public.support_book_revisions (entry_id, household_id, section, body, revised_at, revised_by)
    values (old.id, old.household_id, old.section, old.body, old.updated_at, old.updated_by);
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.record_support_book_revision() from public;

create trigger support_book_entries_revision
  before update on public.support_book_entries
  for each row execute function public.record_support_book_revision();

-- ---------------------------------------------------------------------------
-- 初回登録: 同意の記録・家庭・最初の子どもをまとめて作る
-- ---------------------------------------------------------------------------

create function public.create_household(p_child_name text, p_policy_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'household already exists' using errcode = '23505';
  end if;

  insert into public.consents (user_id, policy_version) values (v_user, p_policy_version);
  insert into public.households default values returning id into v_household;
  insert into public.household_members (household_id, user_id, role) values (v_household, v_user, 'owner');
  insert into public.children (household_id, display_name) values (v_household, p_child_name);

  return v_household;
end;
$$;

revoke all on function public.create_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 共有ページ: トークンで、許可された範囲だけを返す
-- ---------------------------------------------------------------------------

create function public.get_shared_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.share_links;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_sections text[] := array['basic', 'communication', 'likes', 'difficulties', 'calming', 'daily', 'medical'];
  v_result jsonb;
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    return null;
  end if;

  select * into v_link
  from public.share_links
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and revoked_at is null
    and expires_at > now();

  if not found then
    return null;
  end if;

  insert into public.share_link_views (share_link_id, household_id) values (v_link.id, v_link.household_id);

  v_result := jsonb_build_object(
    'label', v_link.label,
    'expires_at', v_link.expires_at,
    'child_name', (select c.display_name from public.children c where c.id = v_link.child_id)
  );

  if 'schedule' = any (v_link.scopes) then
    v_result := v_result || jsonb_build_object('schedule', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', p.date,
          'facility', f.name,
          'pickup_time', p.pickup_time,
          'return_time', p.return_time
        )
        order by p.date, p.pickup_time
      )
      from public.attendance_plans p
      join public.facilities f on f.id = p.facility_id
      where p.child_id = v_link.child_id
        and p.status = 'planned'
        and p.date between v_today and v_today + 13
    ), '[]'::jsonb));
  end if;

  v_result := v_result || jsonb_build_object('support_book', coalesce((
    select jsonb_agg(
      jsonb_build_object('section', e.section, 'body', e.body, 'updated_at', e.updated_at)
      order by array_position(v_sections, e.section)
    )
    from public.support_book_entries e
    where e.child_id = v_link.child_id
      and ('sb:' || e.section) = any (v_link.scopes)
      and e.body <> ''
  ), '[]'::jsonb));

  return v_result;
end;
$$;

revoke all on function public.get_shared_view(text) from public;
grant execute on function public.get_shared_view(text) to anon, authenticated;
