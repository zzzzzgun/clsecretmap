#!/usr/bin/env bash
# 使い方: DATABASE_URL=postgres://user@localhost:5432/postgres npm run test:db
# 指定したサーバー上に houday_test データベースを作り直して、マイグレーションと RLS テストを流す。
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL を指定してください（テスト用の Postgres。中のデータベース houday_test は作り直されます）}"
here="$(cd "$(dirname "$0")" && pwd)"
test_url="${DATABASE_URL%/*}/houday_test"

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c 'drop database if exists houday_test' -c 'create database houday_test'
psql "$test_url" -q -v ON_ERROR_STOP=1 -f "$here/auth_stub.sql"
for f in "$here"/../migrations/*.sql; do
  psql "$test_url" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql "$test_url" -q -v ON_ERROR_STOP=1 -o /dev/null -f "$here/rls_test.sql" 2>&1 | sed -n -e "s/.*NOTICE:  //p" -e "/ERROR/p"
echo "RLS tests passed"
