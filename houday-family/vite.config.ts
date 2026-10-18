import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 利用日数・重複・期限の計算は製品版（houday-poc）と同じコードを使う
const domain = fileURLToPath(new URL('../houday-poc/src/lib/domain', import.meta.url));

export default defineConfig({
  // どこに置いても（GitHub Pages のサブパスでも）動くように相対パスにする
  base: './',
  plugins: [react()],
  resolve: { alias: { '@domain': domain } },
  server: { fs: { allow: ['..'] } },
  test: { include: ['src/**/*.test.ts'] },
});
