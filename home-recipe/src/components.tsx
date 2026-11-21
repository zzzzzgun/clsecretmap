import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { KIND_LABEL, PRESETS, ratingOption, type ItemKind, type Preset, type Rating } from './model';
import { highlightParts, normalize } from './search';

export function Modal({
  title,
  onClose,
  children,
  footer,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      prevFocus?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      className="confirm"
      footer={
        <>
          <button type="button" className="secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className={danger ? 'danger-fill' : ''} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-message">{message}</div>
    </Modal>
  );
}

export function RatingBadge({ value, small }: { value: Rating['value']; small?: boolean }) {
  const o = ratingOption(value);
  return (
    <span className={`rating-badge rating-${value} ${small ? 'small' : ''}`}>
      <span aria-hidden="true">{o.emoji}</span> {o.label}
    </span>
  );
}

export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}

/**
 * 材料・調味料を候補から選ぶ画面。
 * タップで追加（✓がつく）、もう一度タップで外す。候補にないものは名前を入れて追加できる。
 */
export function ItemPicker({
  kind,
  selected,
  used,
  onAdd,
  onRemove,
  onClose,
}: {
  kind: ItemKind;
  /** 編集中のレシピに入っている名前 */
  selected: string[];
  /** ほかのレシピで使ったことのある名前と単位 */
  used: Preset[];
  onAdd: (preset: Preset) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const label = KIND_LABEL[kind];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const q = normalize(query.trim());

  const groups = useMemo(() => {
    const presetNames = new Set(PRESETS[kind].flatMap((g) => g.items.map((i) => i.name)));
    const own = used.filter((u) => !presetNames.has(u.name));
    const all = [...(own.length ? [{ label: 'これまでに使ったもの', items: own }] : []), ...PRESETS[kind]];
    return all
      .map((g) => ({ ...g, items: q ? g.items.filter((i) => normalize(i.name).includes(q)) : g.items }))
      .filter((g) => g.items.length > 0);
  }, [kind, used, q]);

  const exact = groups.some((g) => g.items.some((i) => normalize(i.name) === q)) || selected.some((s) => normalize(s) === q);
  const defaultUnit = kind === 'seasoning' ? '大さじ' : '個';

  const toggle = (preset: Preset) => (selectedSet.has(preset.name) ? onRemove(preset.name) : onAdd(preset));
  const addCustom = () => {
    const name = query.trim();
    if (!name) return;
    if (!selectedSet.has(name)) onAdd({ name, unit: defaultUnit });
    setQuery('');
  };

  return (
    <Modal
      title={`${label}を選ぶ`}
      onClose={onClose}
      className="picker"
      footer={
        <button type="button" onClick={onClose}>
          完了（{selected.length}件）
        </button>
      }
    >
      <input
        type="search"
        className="picker-search"
        placeholder={`${label}の名前で探す・候補にないものを入力`}
        aria-label={`${label}の名前`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const only = groups.flatMap((g) => g.items);
            if (!exact && query.trim()) addCustom();
            else if (only.length === 1) toggle(only[0]);
          }
        }}
      />
      {query.trim() && !exact && (
        <button type="button" className="add-custom" onClick={addCustom}>
          ＋「{query.trim()}」を{label}に追加
        </button>
      )}
      {groups.map((g) => (
        <section key={g.label} className="picker-group">
          <h3>{g.label}</h3>
          <div className="chips">
            {g.items.map((i) => {
              const on = selectedSet.has(i.name);
              return (
                <button
                  type="button"
                  key={i.name}
                  className={`chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(i)}
                >
                  {on && <span aria-hidden="true">✓ </span>}
                  {i.name}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {groups.length === 0 && !query.trim() && <p className="muted">候補がありません</p>}
    </Modal>
  );
}

/** アプリのアイコン（public/icon.svg と同じ絵） */
export function AppIcon({ size = 44 }: { size?: number }) {
  return (
    <svg className="app-icon" width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#c8582a" />
      <path d="M120 250h272c0 75-61 136-136 136s-136-61-136-136z" fill="#fff" />
      <rect x="96" y="232" width="320" height="26" rx="13" fill="#fff" />
      <path
        d="M200 196c-14-18 14-34 0-56M256 196c-14-18 14-34 0-56M312 196c-14-18 14-34 0-56"
        stroke="#fde3d3"
        strokeWidth="16"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const LOGO_NAMES = [
  { text: 'えま', className: 'n-ema' },
  { text: 'たく', className: 'n-taku' },
  { text: 'おしん', className: 'n-oshin' },
  { text: 'ひろ', className: 'n-hiro' },
];

/** 一覧の上のロゴ：アイコン＋「えまたくおしんひろ」＋「のレシピ」 */
export function Logo() {
  return (
    <h1 className="logo" aria-label="えまたくおしんひろのレシピ">
      <AppIcon />
      <span className="logo-text" aria-hidden="true">
        <span className="logo-names">
          {LOGO_NAMES.map((n) => (
            <span key={n.text} className={n.className}>
              {n.text}
            </span>
          ))}
        </span>
        <span className="logo-sub">のレシピ</span>
      </span>
    </h1>
  );
}
