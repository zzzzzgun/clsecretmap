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

// カレンダー: 11月の火・木をまとめて入れる
await page.click('.tabbar >> text=カレンダー');
ok(await page.isVisible('text=受給者証の有効期限（2026-12-10）まであと53日'), '受給者証の期限が近いと知らせる');
await page.click('[aria-label="次の月"]');
await page.click('summary:has-text("曜日でまとめて追加")');
await page.selectOption('#weekly-facility', { label: 'ひまわりデイ' });
await page.check('.weekdays label:has-text("火") input');
await page.check('.weekdays label:has-text("木") input');
await page.fill('#weekly-pickup', '15:00');
await page.click('text=まとめて追加 >> nth=-1');
ok(await page.isVisible('text=利用 8日 / 支給 10日（残り2日）'), '曜日でまとめて8日入り、残り日数が出る');

// 同じ日にさくらデイを入れる → 重複の警告
await page.fill('#plan-date', '2026-11-05');
await page.selectOption('#plan-facility', { label: 'さくらデイ' });
await page.click('form:has(#plan-date) button[type=submit]');
ok(await page.isVisible('text=同じ日に2か所のデイが入っています'), '同じ日に2か所入れると警告が出る');
ok(await page.isVisible('text=利用 8日 / 支給 10日（残り2日）'), '同じ日の2か所目は利用日数に重ねて数えない');
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
ok(Boolean(himawari?.includes('・11/3(火) 迎え 15:00') && himawari?.includes('計8日')), 'デイへの希望日の文面に11月の8日分が入る');
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
ok(await page.isVisible('text=利用 8日 / 支給 10日（残り2日）'), '再読み込みしてもデータが残る');

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
