import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'デイ手帳',
    short_name: 'デイ手帳',
    description: '放デイの利用日とサポートブックをまとめる保護者向けアプリ',
    start_url: '/calendar',
    display: 'standalone',
    background_color: '#f7f6f2',
    theme_color: '#2f6fde',
    lang: 'ja',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
