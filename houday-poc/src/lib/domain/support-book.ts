// サポートブックの項目。自治体のサポートブック様式（基本情報・コミュニケーション・日常の様子・
// 落ち着かないときの対応など）を参考にした PoC 用の構成。

export const SUPPORT_BOOK_SECTIONS = [
  { key: 'basic', label: '基本情報', hint: '呼ばれたい名前、通っている学校・デイ、緊急連絡先の伝え方など' },
  { key: 'communication', label: 'コミュニケーション', hint: '伝わりやすい話し方、言葉以外のサイン、苦手な言い方' },
  { key: 'likes', label: '好きなこと・得意なこと', hint: '夢中になれること、ほめられるとうれしいこと' },
  { key: 'difficulties', label: '苦手なこと・配慮してほしいこと', hint: '音・光・人混み・予定の変更など' },
  { key: 'calming', label: '落ち着かないときの対応', hint: 'サイン、効く方法、やめてほしい対応' },
  { key: 'daily', label: '生活（食事・トイレ・着替え）', hint: 'ひとりでできること、手伝いが必要なこと' },
  { key: 'medical', label: '医療・服薬・アレルギー', hint: '共有する相手を特に慎重に選んでください' },
] as const;

export type SupportBookSection = (typeof SUPPORT_BOOK_SECTIONS)[number]['key'];

export const SECTION_KEYS: readonly SupportBookSection[] = SUPPORT_BOOK_SECTIONS.map((s) => s.key);

export function isSupportBookSection(value: string): value is SupportBookSection {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

export function sectionLabel(section: string): string {
  return SUPPORT_BOOK_SECTIONS.find((s) => s.key === section)?.label ?? section;
}

export const MAX_SECTION_LENGTH = 4000;
