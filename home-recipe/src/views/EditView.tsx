import { useMemo, useRef, useState } from 'react';
import { amountToInput, parseAmount } from '../amount';
import { ConfirmDialog, ItemPicker } from '../components';
import {
  KIND_LABEL,
  SERVING_CHOICES,
  UNIT_GROUPS,
  amountSuggestions,
  hasAmount,
  newId,
  type ItemKind,
  type Preset,
  type Recipe,
} from '../model';
import { go, paths } from '../router';
import { useStore } from '../store';

interface DraftItem {
  id: string;
  kind: ItemKind;
  name: string;
  amountText: string;
  unit: string;
}

interface Draft {
  name: string;
  description: string;
  servings: number;
  items: DraftItem[];
  steps: string[];
}

function toDraft(recipe?: Recipe): Draft {
  if (!recipe) return { name: '', description: '', servings: 4, items: [], steps: [''] };
  return {
    name: recipe.name,
    description: recipe.description,
    servings: recipe.servings,
    items: recipe.items.map((i) => ({ id: i.id, kind: i.kind, name: i.name, unit: i.unit, amountText: amountToInput(i.amount, i.unit) })),
    steps: recipe.steps.length ? [...recipe.steps] : [''],
  };
}

type Errors = { name?: string; items: Record<string, string> };

function validate(d: Draft): Errors {
  const errors: Errors = { items: {} };
  if (!d.name.trim()) errors.name = '料理名を入れてください';
  for (const i of d.items) {
    if (!i.name.trim()) errors.items[i.id] = '名前を入れてください';
    else if (hasAmount(i.unit)) {
      const a = parseAmount(i.amountText);
      if (a === null) errors.items[i.id] = '量を入れてください';
      else if (a === undefined) errors.items[i.id] = '「1」「1.5」「1/2」「1と1/2」のように入れてください';
    }
  }
  return errors;
}

const hasErrors = (e: Errors) => !!e.name || Object.keys(e.items).length > 0;

export function EditView({ recipe }: { recipe?: Recipe }) {
  const { recipes, dispatch, toast } = useStore();
  const initial = useMemo(() => toDraft(recipe), [recipe]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [picker, setPicker] = useState<ItemKind | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = validate(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // ほかのレシピで使ったことのある材料（候補にないもの）を選べるようにする
  const used = useMemo(() => {
    const map: Record<ItemKind, Map<string, Preset>> = { ingredient: new Map(), seasoning: new Map() };
    for (const r of recipes) for (const i of r.items) map[i.kind].set(i.name, { name: i.name, unit: i.unit });
    return { ingredient: [...map.ingredient.values()], seasoning: [...map.seasoning.values()] };
  }, [recipes]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id: string) => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

  const cancelTo = recipe ? paths.detail(recipe.id) : paths.list;

  const submit = () => {
    if (hasErrors(errors)) {
      setShowErrors(true);
      // 最初のエラーの欄へ
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const now = new Date().toISOString();
    const saved: Recipe = {
      id: recipe?.id ?? newId(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      servings: draft.servings,
      items: draft.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        name: i.name.trim(),
        unit: i.unit,
        amount: hasAmount(i.unit) ? (parseAmount(i.amountText) as number) : null,
      })),
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
      ratings: recipe?.ratings ?? [],
      createdAt: recipe?.createdAt ?? now,
      updatedAt: now,
    };
    dispatch({ type: 'save', recipe: saved });
    toast(recipe ? '保存しました' : 'レシピを登録しました');
    go(paths.detail(saved.id), { replace: true });
  };

  return (
    <main>
      <nav className="topbar">
        <button type="button" className="link back" onClick={() => (dirty ? setConfirmLeave(true) : go(cancelTo))}>
          ← {recipe ? '戻る' : '一覧へ'}
        </button>
      </nav>
      <h1>{recipe ? 'レシピを編集' : '新しいレシピ'}</h1>

      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <section className="card">
          <label htmlFor="name">
            料理名 <span className="required">必須</span>
          </label>
          <input
            id="name"
            type="text"
            value={draft.name}
            placeholder="例：肉じゃが"
            aria-invalid={showErrors && !!errors.name}
            aria-describedby={showErrors && errors.name ? 'name-error' : undefined}
            onChange={(e) => update({ name: e.target.value })}
          />
          {showErrors && errors.name && (
            <p className="error" id="name-error">
              {errors.name}
            </p>
          )}

          <label htmlFor="description">説明</label>
          <textarea
            id="description"
            rows={3}
            value={draft.description}
            placeholder="どんな料理か、コツや思い出など"
            onChange={(e) => update({ description: e.target.value })}
          />

          <label htmlFor="servings">何人分のレシピか</label>
          <select id="servings" value={draft.servings} onChange={(e) => update({ servings: Number(e.target.value) })}>
            {SERVING_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}人分
              </option>
            ))}
          </select>
          <p className="hint muted">見るときに人数を変えると、この人数をもとに量を計算し直します。</p>
        </section>

        {(['ingredient', 'seasoning'] as ItemKind[]).map((kind) => {
          const items = draft.items.filter((i) => i.kind === kind);
          return (
            <section className="card" key={kind} data-section={kind}>
              <div className="section-head">
                <h2>
                  {KIND_LABEL[kind]}
                  <span className="count">{items.length}</span>
                </h2>
                <button type="button" className="small" onClick={() => setPicker(kind)}>
                  ＋ {KIND_LABEL[kind]}を選ぶ
                </button>
              </div>
              {items.length === 0 ? (
                <p className="muted">「{KIND_LABEL[kind]}を選ぶ」から追加してください。</p>
              ) : (
                <ul className="edit-items">
                  {items.map((i) => {
                    const error = showErrors ? errors.items[i.id] : undefined;
                    const withAmount = hasAmount(i.unit);
                    const listId = `amount-suggest-${i.id}`;
                    return (
                      <li key={i.id} className={error ? 'has-error' : ''} data-item={i.name}>
                        <input
                          type="text"
                          className="item-name-input"
                          aria-label={`${KIND_LABEL[kind]}の名前`}
                          value={i.name}
                          aria-invalid={!!error && !i.name.trim()}
                          onChange={(e) => updateItem(i.id, { name: e.target.value })}
                        />
                        <div className="amount-row">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="amount-input"
                            aria-label={`${i.name || KIND_LABEL[kind]}の量`}
                            placeholder={withAmount ? '量' : '—'}
                            disabled={!withAmount}
                            list={withAmount ? listId : undefined}
                            value={withAmount ? i.amountText : ''}
                            aria-invalid={!!error && !!i.name.trim()}
                            onChange={(e) => updateItem(i.id, { amountText: e.target.value })}
                          />
                          {withAmount && (
                            <datalist id={listId}>
                              {amountSuggestions(i.unit).map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          )}
                          <select
                            className="unit-select"
                            aria-label={`${i.name || KIND_LABEL[kind]}の単位`}
                            value={i.unit}
                            onChange={(e) => updateItem(i.id, { unit: e.target.value })}
                          >
                            {UNIT_GROUPS.map((g) => (
                              <optgroup key={g.label} label={g.label}>
                                {g.units.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {u.value}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`${i.name || KIND_LABEL[kind]}を外す`}
                            onClick={() => removeItem(i.id)}
                          >
                            ×
                          </button>
                        </div>
                        {error && <p className="error">{error}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}

        <section className="card">
          <h2>作り方</h2>
          <ol className="edit-steps">
            {draft.steps.map((s, idx) => (
              <li key={idx}>
                <span className="step-no" aria-hidden="true">
                  {idx + 1}
                </span>
                <textarea
                  rows={2}
                  aria-label={`手順${idx + 1}`}
                  value={s}
                  placeholder={idx === 0 ? '例：じゃがいもは4等分に切る' : ''}
                  onChange={(e) => update({ steps: draft.steps.map((x, j) => (j === idx ? e.target.value : x)) })}
                />
                <div className="step-tools">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`手順${idx + 1}を上へ`}
                    disabled={idx === 0}
                    onClick={() => update({ steps: move(draft.steps, idx, idx - 1) })}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`手順${idx + 1}を下へ`}
                    disabled={idx === draft.steps.length - 1}
                    onClick={() => update({ steps: move(draft.steps, idx, idx + 1) })}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`手順${idx + 1}を消す`}
                    disabled={draft.steps.length === 1 && !s}
                    onClick={() => {
                      const next = draft.steps.filter((_, j) => j !== idx);
                      update({ steps: next.length ? next : [''] });
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="secondary small" onClick={() => update({ steps: [...draft.steps, ''] })}>
            ＋ 手順を追加
          </button>
        </section>

        {showErrors && hasErrors(errors) && <p className="error summary">入力が足りないところがあります。赤い欄を確認してください。</p>}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => (dirty ? setConfirmLeave(true) : go(cancelTo))}>
            キャンセル
          </button>
          <button type="submit">{recipe ? '保存する' : '登録する'}</button>
        </div>
      </form>

      {picker && (
        <ItemPicker
          kind={picker}
          selected={draft.items.filter((i) => i.kind === picker).map((i) => i.name)}
          used={used[picker]}
          onAdd={(p) =>
            setDraft((d) => ({
              ...d,
              items: [...d.items, { id: newId(), kind: picker, name: p.name, unit: p.unit, amountText: '' }],
            }))
          }
          onRemove={(name) => setDraft((d) => ({ ...d, items: d.items.filter((i) => !(i.kind === picker && i.name === name)) }))}
          onClose={() => setPicker(null)}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="編集をやめますか？"
          message="入力した内容は保存されません。"
          confirmLabel="やめる"
          danger
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => go(cancelTo)}
        />
      )}
    </main>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
}
