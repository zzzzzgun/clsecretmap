import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'デイ手帳', template: '%s | デイ手帳' },
  description: '放課後等デイサービスの利用日と、子どものサポートブックを保護者の手元にまとめるアプリ（PoC）',
  appleWebApp: { capable: true, title: 'デイ手帳', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2f6fde',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
