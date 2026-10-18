// フォームの値を取り出す小さな関数。不正な値は例外にする（画面側の入力チェックは信用しない）

export function text(form: FormData, name: string, { max, required = false }: { max: number; required?: boolean }) {
  const raw = form.get(name);
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (required && value === '') throw new Error(`${name} を入力してください`);
  if (value.length > max) throw new Error(`${name} は${max}文字以内で入力してください`);
  return value;
}

export function optionalText(form: FormData, name: string, max: number): string | null {
  return text(form, name, { max }) || null;
}

export function isoDate(form: FormData, name: string): string {
  const value = text(form, name, { max: 10, required: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${name} の日付が正しくありません`);
  }
  return value;
}

export function optionalTime(form: FormData, name: string): string | null {
  const value = text(form, name, { max: 5 });
  if (value === '') return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${name} の時刻が正しくありません`);
  return value;
}

export function integer(form: FormData, name: string, min: number, max: number): number {
  const value = Number(text(form, name, { max: 4, required: true }));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} は${min}〜${max}の整数で入力してください`);
  }
  return value;
}

export function uuid(form: FormData, name: string): string {
  const value = text(form, name, { max: 36, required: true });
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(`${name} が正しくありません`);
  return value;
}
