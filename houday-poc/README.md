# デイ手帳（PoC）

放課後等デイサービスを使う家庭向けに、**利用日カレンダー**・**学校への共有リンク**・**サポートブック**を保護者の手元にまとめる Web アプリ（PWA）の試作です。
事業所側の導入は不要で、保護者だけで使い始められます。

> 「デイ手帳」は仮の名前です。正式な名前は商標を調べてから決めてください。

## できること

| 画面 | 内容 |
| --- | --- |
| カレンダー `/calendar` | 全てのデイの予定を1つの月表示に。支給日数の残り、同じ日に2か所入っている日（1日1事業所ルール）の警告、受給者証の期限（60日前から）の通知。曜日でまとめて入力できる |
| サポートブック `/support-book` | 7項目（基本情報・コミュニケーション・好きなこと・苦手なこと・落ち着かないとき・生活・医療）。書き直すと前の内容は履歴に残る。印刷 / PDF 保存用の表示つき |
| 共有 `/share` | 学校の先生やデイのスタッフ向けの共有リンク。共有する項目と期限（1週間〜1年）を選べて、いつでも取り消せる。閲覧回数がわかる |
| 共有ページ `/s/<トークン>` | 受け取った人が見るページ。ログイン不要。今後2週間の「どのデイが何時に迎えに来るか」と、許可された項目だけを表示 |
| 設定 `/settings` | 通っているデイ、受給者証（有効期間と支給日数）、お子さんの名前・学校 |

PoC では 1 家庭・子ども 1 人を前提にしています（家族の招待・きょうだいは第2段）。

## 構成

- Next.js 16（App Router）+ TypeScript
- Supabase（Postgres・ログイン）。メールのリンクでログインするのでパスワードは不要
- 権限は全て DB の RLS（行レベルセキュリティ）で守る。画面側のチェックに頼らない

```
src/
  app/                 画面（(app)/ 以下はログインが必要）
  lib/domain/          日付・利用日数・重複・期限・共有の計算（DB に依存しない。テストあり）
  lib/supabase/        Supabase への接続
  proxy.ts             ログインのセッションを毎回更新する（Next.js 16 で middleware から改名）
supabase/
  migrations/          テーブル・RLS・関数
  tests/               RLS のテスト（素の Postgres で動く）
```

### データを守る仕組み

- 全ての行は「家庭」に属し、その家庭のメンバーしか読み書きできない
- 子ども・デイを指す行は `(id, household_id)` の複合外部キーで結び、他の家庭の子どもやデイを指せない
- 共有リンクはトークンの **ハッシュだけ** を保存する。URL は作成時に一度だけ表示する
- 共有ページは `get_shared_view()` 関数を通してのみ読める。期限切れ・取り消し済みのリンクでは何も返さない
- 初回登録時に要配慮個人情報の取り扱いへの同意を取り、`consents` に版と日時を記録する

## セットアップ

1. [Supabase](https://supabase.com) でプロジェクトを作る。**リージョンは Tokyo（Northeast Asia）を選ぶ**
2. SQL Editor で `supabase/migrations/20261018000000_init.sql` を実行する（Supabase CLI を使う場合は `supabase db push`）
3. Authentication の URL Configuration で
   - Site URL: `http://localhost:3000`（公開後は本番の URL）
   - Redirect URLs: `http://localhost:3000/auth/callback`（公開後は本番の URL も追加）
4. 環境変数を用意する

   ```bash
   cp .env.example .env.local
   # Project Settings > API の URL と publishable key（旧 anon key）を入れる
   ```

5. 起動する

   ```bash
   npm install
   npm run dev
   # http://localhost:3000 を開く
   ```

## テスト

```bash
npm test            # 計算ロジック（vitest）
npm run typecheck   # 型チェック
# RLS のテスト。テスト用の Postgres を指定する（中の houday_test データベースは作り直される）
DATABASE_URL=postgres://user:pass@localhost:5432/postgres npm run test:db
```

RLS のテストは「他の家庭のデータが見えない・書けない・参照できない」「共有ページに許可した項目しか出ない」「取り消し・期限切れのリンクは見られない」などを確かめます。**テーブルや権限を変えたら必ず流してください。**

## 公開する前に

- [ ] `src/app/privacy/page.tsx` のプライバシーポリシー（たたき台）を弁護士に確認してもらい、運営者情報を入れる
- [ ] Supabase の Auth に独自の SMTP を設定する（標準のメール送信は回数制限が厳しく、テスト用）
- [ ] Supabase・GitHub・公開先のアカウントを二要素認証にする
- [ ] 公開先を決める。`proxy.ts` は Node.js ランタイムで動くので、対応している公開先を選ぶ（Cloudflare なら `@opennextjs/cloudflare` で対応状況を確認。Vercel の無料プランは商用利用不可）
- [ ] 共有ページ（`get_shared_view`）へのアクセス回数の制限を検討する（トークンは推測不能だが、念のため）

## 次に作るもの（第2段の候補）

- 家族の招待（もう一人の保護者・祖父母）
- 来月の希望日を各デイへ送る文面の自動作成
- 連絡帳の写真の取り込み（外部の AI・OCR を使う場合は、データの処理場所と同意の取り方を先に決める）
- 半年ごとの振り返りレポート、書類（受給者証・個別支援計画）の保管
- きょうだい（子ども複数）への対応
