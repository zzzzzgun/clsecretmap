import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

// 使い方: npm run build && npm run preview（別のターミナルで）→ npm run e2e
// スクリーンショットは e2e/output/ に出る
const OUT = new URL('./output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const URL_ = process.env.E2E_URL ?? 'http://localhost:4173/';
const results = [];
const ok = (cond, label) => {
  results.push(`${cond ? 'ok  ' : 'FAIL'}: ${label}`);
  if (!cond) process.exitCode = 1;
};
// 画面の切り替わりを待ってから確かめる
const visible = (locator) => locator.first().waitFor({ timeout: 5000 }).then(() => true, () => false);
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  // 1. 起動時はレシピ一覧
  await page.goto(URL_);
  ok(await visible(page.getByRole('heading', { name: 'わが家のレシピ' })), '起動時は一覧画面');
  ok(await visible(page.getByText('まだレシピがありません')), '最初は空の案内が出る');
  await shot('01-empty');

  // 2. 新しいレシピを登録
  await page.getByRole('link', { name: '＋ 新しいレシピ' }).click();
  await page.getByRole('button', { name: '登録する' }).click();
  ok(await visible(page.getByText('料理名を入れてください')), '料理名が空だと登録できない');

  await page.getByLabel('料理名').fill('豚汁');
  await page.getByLabel('説明').fill('具だくさんで体が温まる。');
  ok((await page.getByLabel('何人分のレシピか').inputValue()) === '4', '新しいレシピは最初から4人分');
  await page.getByLabel('何人分のレシピか').selectOption('2');

  // 材料を候補から選ぶ
  await page.getByRole('button', { name: '＋ 材料を選ぶ' }).click();
  const picker = page.getByRole('dialog', { name: '材料を選ぶ' });
  for (const n of ['豚バラ肉', '大根', 'にんじん']) await picker.getByRole('button', { name: n, exact: true }).click();
  // 候補を絞り込む・候補にないものを追加する
  await picker.getByLabel('材料の名前').fill('ごぼう');
  await picker.getByRole('button', { name: 'ごぼう', exact: true }).click();
  await picker.getByLabel('材料の名前').fill('里いも');
  await picker.getByRole('button', { name: '＋「里いも」を材料に追加' }).click();
  ok((await picker.getByRole('button', { name: /完了（5件）/ }).count()) === 1, '材料を5つ選べた（候補にないものも追加できる）');
  await shot('02-picker');
  await picker.getByRole('button', { name: /完了/ }).click();

  const fillItem = async (name, amount, unit) => {
    if (unit) await page.getByLabel(`${name}の単位`, { exact: true }).selectOption(unit);
    if (amount !== undefined) await page.getByLabel(`${name}の量`, { exact: true }).fill(amount);
  };
  await fillItem('豚バラ肉', '150');
  await fillItem('大根', '200');
  await fillItem('にんじん', '1/2');
  await fillItem('ごぼう', '1/3');
  await fillItem('里いも', '2', '個');

  await page.getByRole('button', { name: '＋ 調味料を選ぶ' }).click();
  const sPicker = page.getByRole('dialog', { name: '調味料を選ぶ' });
  for (const n of ['みそ', '顆粒だし', 'ごま油']) await sPicker.getByRole('button', { name: n, exact: true }).click();
  await sPicker.getByRole('button', { name: /完了/ }).click();
  await fillItem('みそ', '1と1/2');
  await fillItem('顆粒だし', '1');
  await fillItem('ごま油', '1/2');

  await page.getByLabel('手順1', { exact: true }).fill('野菜はいちょう切り、豚肉は3cm幅に切る。');
  await page.getByRole('button', { name: '＋ 手順を追加' }).click();
  await page.getByLabel('手順2', { exact: true }).fill('みそを溶き入れて完成。');
  await page.getByRole('button', { name: '＋ 手順を追加' }).click();
  await page.getByLabel('手順3', { exact: true }).fill('ごま油で具を炒め、水と顆粒だしを入れて煮る。');
  await page.getByRole('button', { name: '手順3を上へ' }).click();
  ok((await page.getByLabel('手順2', { exact: true }).inputValue()).startsWith('ごま油'), '手順を並べ替えられる');

  // 量が読めないとエラー
  await fillItem('ごま油', 'すこし');
  await page.getByRole('button', { name: '登録する' }).click();
  ok(await visible(page.getByText('「1」「1.5」「1/2」「1と1/2」のように入れてください')), '量が読めないとエラー');
  await fillItem('ごま油', '1/2');
  await shot('03-edit');
  await page.getByRole('button', { name: '登録する' }).click();

  // 3. 詳細と人数の調整
  ok(await visible(page.getByRole('heading', { name: '豚汁' })), '登録すると詳細画面へ');
  const amount = (name) => page.locator('.item-list li', { hasText: name }).locator('.item-amount').innerText();
  ok((await amount('豚バラ肉')) === '150g', '2人分: 豚バラ肉 150g');
  ok((await amount('みそ')) === '大さじ1と1/2', '2人分: みそ 大さじ1と1/2');
  await page.getByRole('button', { name: '1人増やす' }).click();
  await page.getByRole('button', { name: '1人増やす' }).click();
  ok((await page.getByLabel('人数').innerText()) === '4人分', '人数を4人に変えられる');
  ok((await amount('豚バラ肉')) === '300g', '4人分: 豚バラ肉 300g');
  ok((await amount('みそ')) === '大さじ3', '4人分: みそ 大さじ3');
  ok((await amount('にんじん')) === '1本', '4人分: にんじん 1本');
  ok((await amount('顆粒だし')).startsWith('小さじ2'), '4人分: 顆粒だし 小さじ2');
  await page.getByRole('button', { name: '1人増やす' }).click();
  await page.getByRole('button', { name: '1人増やす' }).click();
  ok((await amount('顆粒だし')).replace(/\s+/g, '') === '小さじ3＝大さじ1', '6人分: 小さじ3＝大さじ1 の言い換え');
  ok((await amount('豚バラ肉')) === '450g', '6人分: 豚バラ肉 450g');
  await page.getByRole('button', { name: '1人減らす' }).click();
  await page.getByRole('button', { name: '1人減らす' }).click();
  await page.getByRole('button', { name: '1人減らす' }).click();
  ok((await amount('大根')) === '300g' && (await amount('ごぼう')) === '1/2本', '3人分: 大根 300g・ごぼう 1/2本');
  await shot('04-detail-scaled');
  await page.getByRole('button', { name: '元に戻す' }).click();
  ok((await amount('豚バラ肉')) === '150g', '元の人数に戻せる');

  // 4. 評価
  await page.getByRole('button', { name: '＋ 評価を登録' }).click();
  const rd = page.getByRole('dialog', { name: '評価を登録' });
  ok(await rd.getByRole('button', { name: '登録する' }).isDisabled(), '評価を選ぶまで登録できない');
  await rd.getByRole('radio', { name: /えまたく2人とも食べた/ }).click();
  {
    const labels = await rd.locator('.rating-choice').evaluateAll((els) => els.map((e) => e.lastChild.textContent.trim()));
    ok(
      JSON.stringify(labels) === JSON.stringify(['みんな食べた', 'えまたく2人とも食べた', 'えまだけ食べた', 'たくだけ食べた']),
      `評価の選択肢は4つ ${labels.join('／')}`,
    );
  }
  {
    const dateBox = await rd.getByLabel('作った日').boundingBox();
    const memoBox = await rd.getByLabel('ひとことメモ（任意）').boundingBox();
    ok(Math.abs(dateBox.width - memoBox.width) < 1 && Math.abs(dateBox.x - memoBox.x) < 1, '作った日の枠がメモ欄と同じ幅・位置');
    ok(dateBox.height >= 40 && dateBox.height <= 50, `作った日の枠の高さ ${dateBox.height}px`);
  }
  await rd.getByLabel('ひとことメモ（任意）').fill('おかわりが出た');
  await shot('05-rating');
  await rd.getByRole('button', { name: '登録する' }).click();
  ok(await visible(page.locator('.rating-history').getByText('えまたく2人とも食べた')), '評価が登録される');
  ok(await visible(page.getByText('おかわりが出た')), '評価のメモが出る');

  // 5. 一覧に戻ってサンプルも入れ、検索
  await page.getByRole('link', { name: '← 一覧へ' }).click();
  ok(await visible(page.locator('.recipe-card', { hasText: '豚汁' }).getByText('えまたく2人とも食べた')), '一覧に評価が出る');
  // 空でないのでサンプルボタンはない → localStorage にサンプルを足して再読み込み（再読み込みしても残ることの確認も兼ねる）
  await page.reload();
  ok(await visible(page.locator('.recipe-card', { hasText: '豚汁' })), '再読み込みしても残っている');

  await page.getByRole('link', { name: '豚汁' }).click();
  await page.getByRole('link', { name: '編集する' }).click();
  await page.getByLabel('料理名').fill('具だくさん豚汁');
  await page.getByRole('button', { name: '保存する' }).click();
  ok(await visible(page.getByRole('heading', { name: '具だくさん豚汁' })), '編集して保存できる');
  ok(await visible(page.getByText('おかわりが出た')), '編集しても評価は残る');
  await page.getByRole('link', { name: '← 一覧へ' }).click();

  // もう1件（材料検索の確認用）
  await page.getByRole('link', { name: '＋ 新しいレシピ' }).click();
  await page.getByLabel('料理名').fill('大根サラダ');
  await page.getByRole('button', { name: '＋ 材料を選ぶ' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '大根', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /完了/ }).click();
  await fillItem('大根', '1/4', '本');
  await page.getByRole('button', { name: '登録する' }).click();
  await page.getByRole('link', { name: '← 一覧へ' }).click();

  const search = page.getByLabel('レシピを検索');
  const cards = () => page.locator('.recipe-card h2').allInnerTexts();
  await search.fill('豚');
  ok(JSON.stringify(await cards()) === JSON.stringify(['具だくさん豚汁']), '料理名の部分一致「豚」');
  await search.fill('だいこん');
  ok((await cards()).length === 0, 'ひらがな「だいこん」は漢字「大根」には一致しない（部分一致のみ）');
  await search.fill('大根');
  ok((await cards()).length === 2, '「大根」は料理名と材料の両方で2件');
  await page.getByRole('radio', { name: '料理名' }).click();
  ok(JSON.stringify(await cards()) === JSON.stringify(['大根サラダ']), '料理名だけに絞ると1件');
  await page.getByRole('radio', { name: '材料・調味料' }).click();
  await search.fill('ごま');
  ok(JSON.stringify(await cards()) === JSON.stringify(['具だくさん豚汁']), '調味料「ごま油」でも探せる');
  ok(await visible(page.locator('.matched mark', { hasText: 'ごま油' })), '一致した材料が表示される');
  await page.getByRole('radio', { name: 'すべて' }).click();
  await search.fill('ダクサン');
  ok(JSON.stringify(await cards()) === JSON.stringify(['具だくさん豚汁']), 'カタカナ「ダクサン」でひらがな「具だくさん」に一致');
  await search.fill('ハンバーグ');
  ok(await visible(page.getByText('「ハンバーグ」に一致するレシピはありません')), '一致しないときの表示');
  await search.fill('大根');
  await page.getByRole('radio', { name: 'すべて' }).click();
  await shot('06-search');
  // 検索窓は下にスクロールしても上に残る
  // （レシピ2件だとスクロールしないので、画面を低くして確かめる）
  await page.setViewportSize({ width: 390, height: 420 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  {
    const scrolled = await page.evaluate(() => window.scrollY);
    const box = await page.getByLabel('レシピを検索').boundingBox();
    ok(scrolled > 100 && box && box.y >= 0 && box.y < 30, `スクロールしても検索窓が上に固定（scrollY=${scrolled}, y=${box?.y}）`);
    await page.screenshot({ path: `${OUT}06b-sticky-search.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await search.fill('');

  // 6. 削除（確認メッセージ）
  await page.getByRole('link', { name: '大根サラダ' }).click();
  await page.getByRole('button', { name: 'このレシピを削除' }).click();
  const confirm = page.getByRole('dialog', { name: 'レシピを削除しますか？' });
  ok(await visible(confirm), '削除の前に確認メッセージが出る');
  ok(await visible(confirm.getByText('「大根サラダ」を削除します。')), '確認メッセージに料理名が出る');
  await shot('07-confirm-delete');
  await confirm.getByRole('button', { name: 'キャンセル' }).click();
  ok(await visible(page.getByRole('heading', { name: '大根サラダ' })), 'キャンセルすると消えない');
  await page.getByRole('button', { name: 'このレシピを削除' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
  ok(await visible(page.getByRole('heading', { name: 'わが家のレシピ' })), '削除すると一覧へ戻る');
  ok(JSON.stringify(await cards()) === JSON.stringify(['具だくさん豚汁']), '削除したレシピは一覧から消える');
  await page.reload();
  ok((await cards()).length === 1, '再読み込みしても削除されたまま');
  await shot('08-list');

  // 7. 空の状態からサンプル
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'サンプルを入れて試してみる' }).click();
  ok((await cards()).length === 2, 'サンプルを入れられる');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('link', { name: '肉じゃが' }).click();
  await shot('09-dark-detail');

  ok(errors.length === 0, `ページのエラーなし ${errors.join(' / ')}`);
} catch (e) {
  ok(false, `途中で止まった: ${e.message}`);
  await shot('error');
} finally {
  console.log(results.join('\n'));
  await browser.close();
}
