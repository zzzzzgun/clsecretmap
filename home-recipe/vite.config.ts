import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages のサブパスでも動くように相対パスにする
  base: './',
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
});
