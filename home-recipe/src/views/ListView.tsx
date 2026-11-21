import { useEffect, useMemo, useRef, useState } from 'react';
import { Highlight, RatingBadge } from '../components';
import { latestRating } from '../model';
import { paths } from '../router';
import { sampleRecipes } from '../samples';
import { searchRecipes, sortHits, type SearchField, type SortKey } from '../search';
import { useStore } from '../store';

export interface ListState {
  query: string;
  field: SearchField;
  sort: SortKey;
}

const FIELDS: { value: SearchField; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'name', label: '料理名' },
  { value: 'item', label: '材料・調味料' },
];

export function ListView({ state, onChange }: { state: ListState; onChange: (s: ListState) => void }) {
  const { recipes, dispatch, toast } = useStore();
  const hits = useMemo(() => sortHits(searchRecipes(recipes, state.query, state.field), state.sort), [recipes, state]);
  const searching = state.query.trim() !== '';

  // 検索窓が画面の上にくっついたら下に影をつける
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [recipes.length > 0]);

  return (
    <main>
      <header className="list-head">
        <h1>わが家のレシピ</h1>
        <a className="button" href={paths.new}>
          ＋ 新しいレシピ
        </a>
      </header>

      {recipes.length > 0 && <div ref={sentinel} aria-hidden="true" />}
      {recipes.length > 0 && (
        <div className={`search-box ${stuck ? 'stuck' : ''}`} role="search">
          <div className="search-input">
            <span aria-hidden="true" className="search-icon">
              🔍
            </span>
            <input
              type="search"
              placeholder="料理名や材料で探す（例：じゃがいも）"
              aria-label="レシピを検索"
              value={state.query}
              onChange={(e) => onChange({ ...state, query: e.target.value })}
            />
          </div>
          <div className="search-options">
            <div className="segmented" role="radiogroup" aria-label="検索する対象">
              {FIELDS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={state.field === f.value}
                  className={state.field === f.value ? 'on' : ''}
                  onClick={() => onChange({ ...state, field: f.value })}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              aria-label="並び順"
              value={state.sort}
              onChange={(e) => onChange({ ...state, sort: e.target.value as SortKey })}
            >
              <option value="updated">更新が新しい順</option>
              <option value="name">名前順</option>
              <option value="rating">評価が高い順</option>
            </select>
          </div>
        </div>
      )}
      {recipes.length > 0 && (
        <p className="result-count" aria-live="polite">
          {searching ? `${hits.length}件見つかりました` : `${recipes.length}件のレシピ`}
        </p>
      )}

      {recipes.length === 0 ? (
        <div className="empty card">
          <p className="empty-emoji" aria-hidden="true">
            🍳
          </p>
          <p>
            まだレシピがありません。
            <br />
            家で作った料理を登録してみましょう。
          </p>
          <a className="button" href={paths.new}>
            最初のレシピを登録する
          </a>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              dispatch({ type: 'addMany', recipes: sampleRecipes() });
              toast('サンプルを2件入れました');
            }}
          >
            サンプルを入れて試してみる
          </button>
        </div>
      ) : hits.length === 0 ? (
        <div className="empty card">
          <p>「{state.query.trim()}」に一致するレシピはありません。</p>
          <button type="button" className="secondary" onClick={() => onChange({ ...state, query: '' })}>
            検索をクリア
          </button>
        </div>
      ) : (
        <ul className="recipe-list">
          {hits.map(({ recipe, matchedItems }) => {
            const latest = latestRating(recipe);
            const ingredientCount = recipe.items.filter((i) => i.kind === 'ingredient').length;
            const seasoningCount = recipe.items.length - ingredientCount;
            return (
              <li key={recipe.id}>
                <a className="recipe-card" href={paths.detail(recipe.id)}>
                  <h2>{state.field === 'item' ? recipe.name : <Highlight text={recipe.name} query={state.query} />}</h2>
                  {recipe.description && <p className="desc">{recipe.description}</p>}
                  {searching && matchedItems.length > 0 && (
                    <p className="matched">
                      <span className="matched-label">一致した材料</span>
                      {matchedItems.map((n) => (
                        <mark key={n}>{n}</mark>
                      ))}
                    </p>
                  )}
                  <p className="meta">
                    <span>{recipe.servings}人分</span>
                    <span>材料 {ingredientCount}</span>
                    <span>調味料 {seasoningCount}</span>
                  </p>
                  <p className="meta rating-line">
                    {latest ? (
                      <>
                        <RatingBadge value={latest.value} small />
                        <span className="muted">評価 {recipe.ratings.length}回</span>
                      </>
                    ) : (
                      <span className="muted">まだ評価がありません</span>
                    )}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
