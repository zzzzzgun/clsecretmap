function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`環境変数 ${name} が設定されていません（.env.example を参照）`);
  return value;
}

// NEXT_PUBLIC_ の値はビルド時に埋め込まれるため、process.env.X と直接書く必要がある
export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseKey() {
    return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  },
  get siteUrl() {
    return required('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, '');
  },
};
