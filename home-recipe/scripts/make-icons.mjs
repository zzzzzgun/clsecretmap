import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

// public/icon.svg（お椀の絵）から、ホーム画面用の PNG を作る。
// 使い方: npm run icons
//  - apple-touch-icon.png (180) : iPhone のホーム画面用。iPhone が自分で角を丸めるので、角まで塗った正方形にする
//  - icon-192.png / icon-512.png : Android などのホーム画面用（角丸）
//  - icon-maskable-512.png       : Android が丸や角丸に切り抜く用（角まで塗った正方形。絵は中央の安全な範囲に収まっている）
const pub = new URL('../public/', import.meta.url);
const rounded = readFileSync(new URL('icon.svg', pub), 'utf8');
const square = rounded.replace(/<rect width="512" height="512" rx="112"/, '<rect width="512" height="512"');
if (square === rounded) throw new Error('icon.svg の背景の形が想定と違います');

const targets = [
  { file: 'apple-touch-icon.png', svg: square, size: 180 },
  { file: 'icon-192.png', svg: rounded, size: 192 },
  { file: 'icon-512.png', svg: rounded, size: 512 },
  { file: 'icon-maskable-512.png', svg: square, size: 512 },
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const svg = t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(new URL(t.file, pub), png);
  console.log(`${t.file} (${t.size}x${t.size})`);
}
await browser.close();
