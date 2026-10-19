import { useEffect, useState } from 'react';
import { getPhoto } from './storage';
import { facilitiesForChild } from './model';
import { useStore } from './store';

export function CopyButton({ text, label = 'コピー' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('コピーしてください', text);
        }
      }}
    >
      {copied ? 'コピーしました' : label}
    </button>
  );
}

/** 端末に保存した写真を表示する */
export function StoredPhoto({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getPhoto(id).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className="photo" />
    </a>
  );
}

export function FacilitySelect({
  id,
  name = 'facilityId',
  allowNone = false,
  defaultId,
  childId,
}: {
  id: string;
  childId: string;
  name?: string;
  allowNone?: boolean;
  defaultId?: string;
}) {
  const { state } = useStore();
  const active = facilitiesForChild(state.facilities, childId).filter((f) => !f.archived);
  return (
    <select id={id} name={name} required={!allowNone} defaultValue={defaultId ?? active[0]?.id ?? ''}>
      {allowNone && <option value="">（デイ以外・家での様子）</option>}
      {active.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** フォームの値を文字列で取り出す */
export function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim() : '';
}
