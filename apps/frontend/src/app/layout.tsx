import type { Metadata, Viewport } from 'next';
import { Inter, Orbitron, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { DockerUserAppHint } from '@/components/DockerUserAppHint';
import { Toaster } from '@/components/ui/toaster';
import { BRAND_NAME_SHORT } from '@/lib/brand';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0e11',
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: BRAND_NAME_SHORT,
  description: `${BRAND_NAME_SHORT} — digital assets and global FX. Crypto spot and Forex on one professional platform.`,
  keywords: [BRAND_NAME_SHORT, 'crypto', 'exchange', 'bitcoin', 'ethereum', 'trading'],
  applicationName: BRAND_NAME_SHORT,
  openGraph: {
    title: BRAND_NAME_SHORT,
    description: `Trade spot and P2P markets on ${BRAND_NAME_SHORT} with wallet management and account security controls.`,
    siteName: BRAND_NAME_SHORT,
    type: 'website',
  },
  icons: {
    icon: [
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${orbitron.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <Providers>
          <DockerUserAppHint />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
