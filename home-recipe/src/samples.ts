import { newId, today, type ItemKind, type Recipe, type RecipeItem } from './model';

const item = (kind: ItemKind, name: string, amount: number | null, unit: string): RecipeItem => ({
  id: newId(),
  kind,
  name,
  amount,
  unit,
});

/** 一覧が空のときに「サンプルを入れてみる」で入るレシピ */
export function sampleRecipes(): Recipe[] {
  const now = new Date().toISOString();
  return [
    {
      id: newId(),
      name: '肉じゃが',
      description: 'ほっとする定番の味。じゃがいもは煮崩れしにくいメークインがおすすめ。',
      servings: 4,
      items: [
        item('ingredient', '牛こま切れ肉', 200, 'g'),
        item('ingredient', 'じゃがいも', 4, '個'),
        item('ingredient', '玉ねぎ', 1, '個'),
        item('ingredient', 'にんじん', 1, '本'),
        item('ingredient', 'しらたき', 1, '袋'),
        item('ingredient', '水', 300, 'ml'),
        item('seasoning', 'しょうゆ', 4, '大さじ'),
        item('seasoning', '砂糖', 2, '大さじ'),
        item('seasoning', 'みりん', 2, '大さじ'),
        item('seasoning', '酒', 2, '大さじ'),
        item('seasoning', '顆粒だし', 1, '小さじ'),
        item('seasoning', 'サラダ油', 1, '大さじ'),
      ],
      steps: [
        'じゃがいもは4等分、玉ねぎはくし切り、にんじんは乱切りにする。しらたきは下ゆでして食べやすく切る。',
        '鍋にサラダ油を熱し、牛肉を炒める。色が変わったら野菜としらたきを加えて炒め合わせる。',
        '水・顆粒だし・調味料を入れ、落としぶたをして弱めの中火で15分煮る。',
        'じゃがいもに竹串がすっと通ったら火を止め、そのまま少し置いて味をなじませる。',
      ],
      ratings: [{ id: newId(), date: today(), value: 'all', comment: '子どもがおかわりした' }],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      name: '鶏の照り焼き',
      description: 'フライパンひとつで。お弁当にも。',
      servings: 2,
      items: [
        item('ingredient', '鶏もも肉', 300, 'g'),
        item('ingredient', '片栗粉', 1, '大さじ'),
        item('seasoning', 'しょうゆ', 2, '大さじ'),
        item('seasoning', 'みりん', 2, '大さじ'),
        item('seasoning', '砂糖', 1, '小さじ'),
        item('seasoning', 'サラダ油', 1 / 2, '大さじ'),
        item('seasoning', '塩こしょう', null, '少々'),
      ],
      steps: [
        '鶏肉は厚いところを開き、塩こしょうをして片栗粉を薄くまぶす。',
        'フライパンに油を熱し、皮目から中火で焼く。焼き色がついたら裏返し、ふたをして弱火で5分。',
        '余分な脂をふき取り、しょうゆ・みりん・砂糖を加えて煮からめる。',
      ],
      ratings: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}
