import { chromium } from 'playwright';
import { deflateSync } from 'node:zlib';

// 使い方: npm run build && npm run preview（別のターミナルで）→ npm run e2e
// スクリーンショットとバックアップファイルは e2e/output/ に出る
import { mkdirSync } from 'node:fs';
const OUT = new URL('./output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const URL_ = process.env.E2E_URL ?? 'http://localhost:4173/';
const results = [];
const ok = (cond, label) => {
  results.push(`${cond ? 'ok  ' : 'FAIL'}: ${label}`);
  if (!cond) process.exitCode = 1;
};

// 小さな PNG（連絡帳の写真の代わり）
function png(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x88);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 手元に Playwright のブラウザがない場合は npx playwright install chromium
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
  acceptDownloads: true,
});
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', (d) => d.accept());

// 日付に依存する確認（期限まで53日、来月の火・木など）があるので、時計を固定する
const NOW = new Date('2026-10-18T10:00:00+09:00');
await page.clock.setFixedTime(NOW);
await page.goto(URL_);
await page.screenshot({ path: `${OUT}01-first-run.png`, fullPage: true });
await page.fill('#first-name', 'たろう');
await page.click('text=はじめる');

// 設定: デイ2つと受給者証（期限が近いもの）
for (const name of ['ひまわりデイ', 'さくらデイ']) {
  await page.fill('#facility-name', name);
  await page.click('form:has(#facility-name) button[type=submit]');
}
ok((await page.locator('.plan-list li').filter({ hasText: 'デイ' }).count()) === 2, 'デイを2つ登録できる');
await page.fill('#cert-from', '2026-04-01');
await page.fill('#cert-until', '2026-12-10');
await page.fill('#cert-days', '10');
await page.click('text=受給者証を登録');
ok(await page.isVisible('text=2026-04-01 〜 2026-12-10・月10日'), '受給者証を登録できる');

// 学校の時間（下校時刻・曜日ごとの授業時間）と、デイのいつもの時刻
await page.fill('input[name="dismissal-5"]', '14:00');
await page.fill('input[name="dismissal-6"]', '15:00');
await page.selectOption('select[name="periods-2"]', '6');
await page.selectOption('select[name="periods-4"]', '6');
await page.click('form:has(input[name="dismissal-6"]) button[type=submit]');
await page.locator('li:has-text("ひまわりデイ") summary').click();
await page.locator('li:has-text("ひまわりデイ") input[name="weekdayReturn"]').fill('17:30');
await page.locator('li:has-text("ひまわりデイ") input[name="homePickup"]').fill('09:30');
await page.locator('li:has-text("ひまわりデイ") input[name="homeReturn"]').fill('16:00');
await page.locator('li:has-text("ひまわりデイ") form button[type=submit]').click();
ok(await page.isVisible('text=平日 帰宅 17:30'), 'デイのいつもの時刻を登録できる');

// カレンダー: 11月の火・木をまとめて入れる
await page.click('.tabbar >> text=カレンダー');
ok(await page.isVisible('text=受給者証の有効期限（2026-12-10）まであと53日'), '受給者証の期限が近いと知らせる');
await page.click('[aria-label="次の月"]');
await page.click('summary:has-text("曜日でまとめて追加")');
await page.selectOption('#weekly-facility', { label: 'ひまわりデイ' });
await page.check('.weekdays label:has-text("火") input');
await page.check('.weekdays label:has-text("木") input');
await page.click('text=まとめて追加 >> nth=-1');
ok(await page.isVisible('text=利用 7日 / 支給 10日（残り3日）'), '曜日でまとめて7日入り（祝日の11/3は除く）、残り日数が出る');
ok(await page.isVisible('text=祝日の 11/3(火・祝) は入れていません'), 'まとめて追加で祝日を飛ばしたことを知らせる');
ok(await page.isVisible('.calendar .day.holiday:has-text("祝")'), 'カレンダーで祝日が分かる');
ok(await page.isVisible('text=この月の祝日：11/3(火・祝) 文化の日、11/23(月・祝) 勤労感謝の日'), 'その月の祝日の一覧が出る');

// 同じ日にさくらデイを入れる → 重複の警告
// 土曜日を選ぶと「家から」、平日を選ぶと「学校から」と下校時刻が自動で入る
await page.fill('#plan-date', '2026-11-07');
ok(
  (await page.locator('.segmented label.on').textContent()) === '家から' && (await page.inputValue('#plan-pickup')) === '09:30',
  '土曜日は家からのお迎えになり、デイのいつもの時刻が入る',
);
await page.fill('#plan-date', '2026-11-12');
ok(
  (await page.locator('.segmented label.on').textContent()) === '学校から' &&
    (await page.inputValue('#plan-pickup')) === '15:00' &&
    (await page.inputValue('#plan-return')) === '17:30',
  '平日は学校からになり、曜日の授業時間の下校時刻が入る',
);
await page.fill('#plan-date', '2026-11-05');
await page.selectOption('#plan-facility', { label: 'さくらデイ' });
await page.click('form:has(#plan-date) button[type=submit]');
ok(await page.isVisible('text=同じ日に2か所のデイが入っています'), '同じ日に2か所入れると警告が出る');
ok(await page.isVisible('text=利用 7日 / 支給 10日（残り3日）'), '同じ日の2か所目は利用日数に重ねて数えない');
ok(await page.isVisible('text=学校お迎え 15:00（6時間）・帰宅 17:30'), 'まとめて追加でも下校時刻と帰宅時刻が入る');

// 短縮授業の日だけ授業時間を変える
const nov10 = page.locator('.plan-list li:has-text("11/10(火)")');
await nov10.locator('button:has-text("時刻")').click();
await nov10.locator('select').selectOption('5');
await nov10.locator('form button[type=submit]').click();
ok(await nov10.locator('text=学校お迎え 14:00（5時間）・帰宅 17:30').isVisible(), '1日だけ授業時間を変えると下校時刻が変わる');
await page.screenshot({ path: `${OUT}02-calendar.png`, fullPage: true });

// サポートブック: 保存と履歴
await page.click('.tabbar >> text=サポートブック');
await page.fill('#sb-likes', '電車が好き');
await page.click('form:has(#sb-likes) button[type=submit]');
await page.fill('#sb-likes', '電車と恐竜が好き');
await page.click('form:has(#sb-likes) button[type=submit]');
ok(await page.isVisible('text=これまでの内容（1件）'), 'サポートブックを書き直すと履歴が残る');
await page.screenshot({ path: `${OUT}03-support-book.png` });

// 様子の記録: 文章と写真
await page.click('.tabbar >> text=様子');
await page.fill('#log-text', '公園で鬼ごっこ。自分から友だちを誘えた');
await page.setInputFiles('#log-photos', { name: 'renrakucho.png', mimeType: 'image/png', buffer: png(800, 600) });
await page.click('text=記録する');
await page.waitForSelector('img.photo');
ok(await page.isVisible('text=自分から友だちを誘えた'), '様子を記録できる');
ok((await page.locator('img.photo').count()) === 1, '写真を付けて保存できる');
await page.screenshot({ path: `${OUT}04-log.png`, fullPage: true });

// 連絡: 学校向けの週の予定と、デイへの希望日の文面
await page.click('.tabbar >> text=連絡');
const requests = await page.locator('.message-preview').allTextContents();
const himawari = requests.find((t) => t.startsWith('ひまわりデイ'));
ok(Boolean(himawari?.includes('・11/5(木) 学校お迎え 15:00（6時間）・帰宅 17:30') && himawari?.includes('計7日') && !himawari?.includes('11/3')), 'デイへの希望日の文面に11月の7日分が入る');
await page.screenshot({ path: `${OUT}05-messages.png`, fullPage: true });
ok(await page.isVisible('strong:has-text("（来週）")'), '週末に開くと来週の予定が出る');
await page.click('[aria-label="次の週"]');
await page.click('[aria-label="次の週"]');
const nov5 = await page.locator('tr:has(th:has-text("11/5(木)")) td').textContent();
ok(nov5.includes('ひまわりデイ（迎え 15:00）') && nov5.includes('さくらデイ'), `学校向けの週の予定に、その日のデイが並ぶ（${nov5}）`);
await page.screenshot({ path: `${OUT}06-school-week.png` });

// 再読み込みしても残る
await page.reload();
await page.click('.tabbar >> text=カレンダー');
await page.click('[aria-label="次の月"]');
ok(await page.isVisible('text=利用 7日 / 支給 10日（残り3日）'), '再読み込みしてもデータが残る');

// バックアップ → 全部消えた状態に戻す
await page.click('.tabbar >> text=設定');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=バックアップを書き出す')]);
const backupPath = `${OUT}backup.json`;
await download.saveAs(backupPath);
ok(await page.isVisible('text=バックアップを書き出しました'), 'バックアップを書き出せる');

const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
const page2 = await fresh.newPage();
page2.on('dialog', (d) => d.accept());
page2.on('pageerror', (e) => errors.push(String(e)));
await page2.clock.setFixedTime(NOW);
await page2.goto(URL_);
await page2.fill('#first-name', '仮');
await page2.click('text=はじめる');
await page2.setInputFiles('input[type=file][accept*="json"]', backupPath);
await page2.waitForSelector('text=バックアップから戻しました');
await page2.click('.tabbar >> text=様子');
await page2.waitForSelector('img.photo');
ok(await page2.isVisible('text=自分から友だちを誘えた'), '別の端末でバックアップから記録と写真を戻せる');
ok(await page2.isVisible('header >> text=たろうさん'), '戻したあとはバックアップのお子さんが表示される');

ok(errors.length === 0, `ブラウザのエラーなし ${errors.join(' | ')}`);
console.log(results.join('\n'));
await browser.close();
