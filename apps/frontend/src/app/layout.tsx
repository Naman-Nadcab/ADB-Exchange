import type { Metadata, Viewport } from 'next';
import { Inter, Orbitron, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { DockerUserAppHint } from '@/components/DockerUserAppHint';
import { Toaster } from '@/components/ui/toaster';

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
  title: 'Metherium — Spot & P2P Crypto Exchange',
  description: 'Metherium — spot and P2P crypto exchange with wallet, API access, and account security controls.',
  keywords: ['Metherium', 'crypto', 'exchange', 'bitcoin', 'ethereum', 'trading'],
  applicationName: 'Metherium',
  openGraph: {
    title: 'Metherium — Spot & P2P Crypto Exchange',
    description: 'Trade spot and P2P markets on Metherium with wallet management and account security controls.',
    siteName: 'Metherium',
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
