import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { BRAND_NAME_FULL } from '@/lib/brand';

const ADMIN_TITLE = `${BRAND_NAME_FULL} Administration`;

export const metadata: Metadata = {
  title: ADMIN_TITLE,
  description: `${BRAND_NAME_FULL} Administration`,
  applicationName: ADMIN_TITLE,
  openGraph: {
    title: ADMIN_TITLE,
    description: `${BRAND_NAME_FULL} Administration`,
    siteName: BRAND_NAME_FULL,
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
