import { useState } from 'react';
import { displayAmount } from '../amount';
import { ConfirmDialog, Modal, RatingBadge } from '../components';
import { ALL_RATING_OPTIONS, KIND_LABEL, RATING_OPTIONS, sortedRatings, today, type ItemKind, type Rating, type RatingValue, type Recipe } from '../model';
import { go, paths } from '../router';
import { useStore } from '../store';

const MAX_SERVINGS = 20;

export function DetailView({ recipe }: { recipe: Recipe }) {
  const { dispatch, toast } = useStore();
  const [servings, setServings] = useState(recipe.servings);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rating, setRating] = useState(false);
  const [deleteRating, setDeleteRating] = useState<Rating | null>(null);
  const changed = servings !== recipe.servings;

  return (
    <main>
      <nav className="topbar">
        <a href={paths.list} className="back">
          ← 一覧へ
        </a>
        <a href={paths.edit(recipe.id)} className="button secondary small">
          編集する
        </a>
      </nav>

      <h1 className="recipe-title">{recipe.name}</h1>
      {recipe.description && <p className="description">{recipe.description}</p>}

      <section className="card">
        <div className="servings">
          <span className="servings-label">食べる人数</span>
          <div className="stepper">
            <button
              type="button"
              aria-label="1人減らす"
              disabled={servings <= 1}
              onClick={() => setServings((s) => Math.max(1, s - 1))}
            >
              −
            </button>
            <output aria-live="polite" aria-label="人数">
              {servings}人分
            </output>
            <button
              type="button"
              aria-label="1人増やす"
              disabled={servings >= MAX_SERVINGS}
              onClick={() => setServings((s) => Math.min(MAX_SERVINGS, s + 1))}
            >
              ＋
            </button>
          </div>
        </div>
        <p className="servings-note muted">
          {changed ? (
            <>
              元のレシピは{recipe.servings}人分。量を{servings}人分に計算し直しています。{' '}
              <button type="button" className="link" onClick={() => setServings(recipe.servings)}>
                元に戻す
              </button>
            </>
          ) : (
            <>このレシピは{recipe.servings}人分です</>
          )}
        </p>

        {(['ingredient', 'seasoning'] as ItemKind[]).map((kind) => {
          const items = recipe.items.filter((i) => i.kind === kind);
          return (
            <div key={kind} className="item-block">
              <h2>{KIND_LABEL[kind]}</h2>
              {items.length === 0 ? (
                <p className="muted">なし</p>
              ) : (
                <ul className={`item-list ${changed ? 'scaled' : ''}`} data-kind={kind}>
                  {items.map((i) => {
                    const a = displayAmount(i, recipe.servings, servings);
                    return (
                      <li key={i.id}>
                        <span className="item-name">{i.name}</span>
                        <span className="item-amount">
                          {a.text}
                          {a.hint && <small className="hint">{a.hint}</small>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2>作り方</h2>
        {recipe.steps.length === 0 ? (
          <p className="muted">作り方はまだ書かれていません</p>
        ) : (
          <ol className="steps">
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>評価</h2>
          <button type="button" className="small" onClick={() => setRating(true)}>
            ＋ 評価を登録
          </button>
        </div>
        {recipe.ratings.length === 0 ? (
          <p className="muted">作ったら、家族の反応を記録しておきましょう。</p>
        ) : (
          <>
            <RatingSummary recipe={recipe} />
            <ul className="rating-history">
              {sortedRatings(recipe).map((r) => (
                <li key={r.id}>
                  <div className="rating-row">
                    <span className="rating-date">{formatDate(r.date)}</span>
                    <RatingBadge value={r.value} small />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`${formatDate(r.date)}の評価を削除`}
                      onClick={() => setDeleteRating(r)}
                    >
                      ×
                    </button>
                  </div>
                  {r.comment && <p className="rating-comment">{r.comment}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="danger-zone">
        <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
          このレシピを削除
        </button>
      </div>

      {rating && (
        <RatingForm
          onClose={() => setRating(false)}
          onSubmit={(r) => {
            dispatch({ type: 'addRating', id: recipe.id, rating: r });
            setRating(false);
            toast('評価を登録しました');
          }}
        />
      )}

      {deleteRating && (
        <ConfirmDialog
          title="評価を削除しますか？"
          message={`${formatDate(deleteRating.date)}の評価を削除します。`}
          confirmLabel="削除する"
          danger
          onCancel={() => setDeleteRating(null)}
          onConfirm={() => {
            dispatch({ type: 'deleteRating', id: recipe.id, ratingId: deleteRating.id });
            setDeleteRating(null);
            toast('評価を削除しました');
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="レシピを削除しますか？"
          message={
            <>
              <p>
                「<strong>{recipe.name}</strong>」を削除します。
              </p>
              <p>材料・作り方・評価もすべて消え、元に戻すことはできません。</p>
            </>
          }
          confirmLabel="削除する"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: 'delete', id: recipe.id });
            toast(`「${recipe.name}」を削除しました`);
            go(paths.list, { replace: true });
          }}
        />
      )}
    </main>
  );
}

function RatingSummary({ recipe }: { recipe: Recipe }) {
  const counts = ALL_RATING_OPTIONS.map((o) => ({ ...o, count: recipe.ratings.filter((r) => r.value === o.value).length })).filter(
    (o) => o.count > 0,
  );
  return (
    <p className="rating-summary">
      {counts.map((o) => (
        <span key={o.value}>
          <span aria-hidden="true">{o.emoji}</span> {o.label} <strong>{o.count}回</strong>
        </span>
      ))}
    </p>
  );
}

function RatingForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (r: Omit<Rating, 'id'>) => void }) {
  const [value, setValue] = useState<RatingValue | null>(null);
  const [date, setDate] = useState(today());
  const [comment, setComment] = useState('');
  return (
    <Modal
      title="評価を登録"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            disabled={!value || !date}
            onClick={() => value && onSubmit({ value, date, comment: comment.trim() })}
          >
            登録する
          </button>
        </>
      }
    >
      <p className="field-label" id="rating-choice-label">
        食べたときの様子
      </p>
      <div className="rating-choices" role="radiogroup" aria-labelledby="rating-choice-label">
        {RATING_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`rating-choice rating-${o.value} ${value === o.value ? 'on' : ''}`}
            onClick={() => setValue(o.value)}
          >
            <span className="emoji" aria-hidden="true">
              {o.emoji}
            </span>
            {o.label}
          </button>
        ))}
      </div>
      <label htmlFor="rating-date">作った日</label>
      <input id="rating-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      <label htmlFor="rating-comment">ひとことメモ（任意）</label>
      <textarea
        id="rating-comment"
        rows={2}
        placeholder="例：次は砂糖を少し減らす"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
    </Modal>
  );
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const w = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  return `${y}/${m}/${d}（${w}）`;
}
