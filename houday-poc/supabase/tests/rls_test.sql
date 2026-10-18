-- RLS（行レベルセキュリティ）の検証
-- 一番大事なこと: 他の家庭のデータは、読めない・書けない・参照できない。

create schema tests;

create function tests.ok(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_label;
  end if;
  raise notice 'ok: %', p_label;
end;
$$;

-- 実行すると失敗する（エラーになる）ことを確かめる
create function tests.fails(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok: % (%)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % (エラーにならなかった)', p_label;
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- 家庭A -------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

select public.create_household('たろう', '2026-10') as household_a \gset
select id as child_a from public.children \gset

insert into public.facilities (household_id, name) values (:'household_a', 'ひまわりデイ')
  returning id as facility_a \gset
insert into public.attendance_plans (household_id, child_id, facility_id, date, pickup_time)
  values (:'household_a', :'child_a', :'facility_a', (now() at time zone 'Asia/Tokyo')::date + 1, '15:00');
insert into public.certificates (household_id, child_id, valid_from, valid_until, monthly_days)
  values (:'household_a', :'child_a', '2026-04-01', '2027-03-31', 23);
insert into public.support_book_entries (household_id, child_id, section, body) values
  (:'household_a', :'child_a', 'likes', '電車が好き'),
  (:'household_a', :'child_a', 'medical', 'てんかんの薬を朝に服用');

select tests.fails(
  $$select public.create_household('じろう', '2026-10')$$,
  '1つのアカウントで家庭を2つ作れない'
);

-- アプリの保存は upsert（insert ... on conflict do update）で行う
insert into public.support_book_entries (household_id, child_id, section, body)
  values (:'household_a', :'child_a', 'likes', '電車と恐竜が好き')
  on conflict (child_id, section) do update set body = excluded.body;
select tests.ok(
  (select count(*) = 1 and min(body) = '電車が好き' from public.support_book_revisions),
  'サポートブックを上書き保存すると前の内容が履歴に残る'
);
select tests.ok(
  (select body = '電車と恐竜が好き' from public.support_book_entries where section = 'likes'),
  '上書き保存で新しい内容になる'
);

insert into public.share_links (household_id, child_id, token_hash, label, scopes, expires_at)
  values (
    :'household_a', :'child_a',
    encode(sha256(convert_to('token-for-teacher-0123456789abcdef', 'UTF8')), 'hex'),
    '担任の先生', array['schedule', 'sb:likes'], now() + interval '30 days'
  );

select tests.fails(
  $$update public.share_links set token_hash = repeat('0', 64)$$,
  '共有リンクのトークンは作成後に変えられない'
);

-- 家庭B -------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

select public.create_household('はなこ', '2026-10') as household_b \gset
select id as child_b from public.children \gset

select tests.ok((select count(*) = 1 from public.children), 'Bには自分の子どもだけが見える');
select tests.ok((select count(*) = 0 from public.attendance_plans), 'BにはAの利用予定が見えない');
select tests.ok((select count(*) = 0 from public.support_book_entries), 'BにはAのサポートブックが見えない');
select tests.ok((select count(*) = 0 from public.support_book_revisions), 'BにはAの更新履歴が見えない');
select tests.ok((select count(*) = 0 from public.share_links), 'BにはAの共有リンクが見えない');
select tests.ok((select count(*) = 1 from public.households), 'Bには自分の家庭だけが見える');
select tests.ok((select count(*) = 1 from public.household_members), 'Bには自分の家庭のメンバーだけが見える');

select tests.fails(
  format(
    $$insert into public.facilities (household_id, name) values (%L, '乗っ取りデイ')$$,
    :'household_a'
  ),
  'BはAの家庭にデイを登録できない'
);

insert into public.facilities (household_id, name) values (:'household_b', 'さくらデイ')
  returning id as facility_b \gset

select tests.fails(
  format(
    $$insert into public.attendance_plans (household_id, child_id, facility_id, date)
      values (%L, %L, %L, current_date)$$,
    :'household_b', :'child_a', :'facility_b'
  ),
  'BはAの子どもを指す予定を自分の家庭に作れない'
);

select tests.fails(
  format(
    $$insert into public.attendance_plans (household_id, child_id, facility_id, date)
      values (%L, %L, %L, current_date)$$,
    :'household_b', :'child_b', :'facility_a'
  ),
  'BはAのデイを指す予定を作れない'
);

select tests.fails(
  format(
    $$insert into public.support_book_entries (household_id, child_id, section, body)
      values (%L, %L, 'likes', '乗っ取り')
      on conflict (child_id, section) do update set body = excluded.body$$,
    :'household_a', :'child_a'
  ),
  'BはAのサポートブックを上書き保存できない'
);

update public.children set display_name = '書き換え' where id = :'child_a';
update public.share_links set revoked_at = now();
delete from public.support_book_entries where child_id = :'child_a';
select tests.fails(
  $$insert into public.household_members (household_id, user_id) values
    ((select id from public.households limit 1), '00000000-0000-0000-0000-00000000000a')$$,
  'メンバーを直接追加できない'
);

-- Aに戻って、Bの操作が効いていないことを確かめる
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select tests.ok((select display_name = 'たろう' from public.children), 'BはAの子どもの名前を書き換えられない');
select tests.ok((select count(*) = 2 from public.support_book_entries), 'BはAのサポートブックを消せない');
select tests.ok((select revoked_at is null from public.share_links), 'BはAの共有リンクを取り消せない');

-- 未ログイン（共有ページ） ---------------------------------------------------
reset request.jwt.claim.sub;
set role anon;

select tests.fails($$select * from public.children$$, '未ログインではテーブルを直接読めない');
select tests.fails($$select * from public.share_links$$, '未ログインでは共有リンクの一覧を読めない');

select public.get_shared_view('token-for-teacher-0123456789abcdef') as shared \gset
select tests.ok((:'shared'::jsonb ->> 'child_name') = 'たろう', '共有ページに子どもの名前が出る');
select tests.ok(jsonb_array_length(:'shared'::jsonb -> 'schedule') = 1, '共有ページに今後の予定が出る');
select tests.ok(
  jsonb_array_length(:'shared'::jsonb -> 'support_book') = 1
    and (:'shared'::jsonb -> 'support_book' -> 0 ->> 'section') = 'likes',
  '共有ページには許可した項目だけが出る（医療情報は出ない）'
);
select tests.ok(public.get_shared_view('wrong-token-0123456789abcdef0123456') is null, '違うトークンでは何も返さない');
select tests.ok(public.get_shared_view('short') is null, '短すぎるトークンは受け付けない');

-- 取り消しと期限切れ ---------------------------------------------------------
reset role;
update public.share_links set revoked_at = now();
set role anon;
select tests.ok(
  public.get_shared_view('token-for-teacher-0123456789abcdef') is null,
  '取り消した共有リンクは見られない'
);

reset role;
update public.share_links
  set revoked_at = null, created_at = now() - interval '40 days', expires_at = now() - interval '10 days';
set role anon;
select tests.ok(
  public.get_shared_view('token-for-teacher-0123456789abcdef') is null,
  '期限切れの共有リンクは見られない'
);

reset role;
select tests.ok((select count(*) = 1 from public.share_link_views), '共有ページの閲覧が記録される');
