import type { Metadata, Viewport } from 'next';
import { Inter, Orbitron, IBM_Plex_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Providers } from '@/components/providers';
import { DockerUserAppHint } from '@/components/DockerUserAppHint';
import { Toaster } from '@/components/ui/toaster';
import { BRAND_NAME, BRAND_PRODUCT } from '@/lib/brand';
import { localeToHtmlLang } from '@/i18n/request';
import { isAppLocale } from '@/i18n/config';

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || 'http://109.123.254.30'),
  title: BRAND_NAME,
  description: `${BRAND_NAME}. ${BRAND_PRODUCT.crypto} and ${BRAND_PRODUCT.forex} on one account.`,
  keywords: [BRAND_NAME, 'crypto', 'forex', 'spot', 'p2p', 'trading'],
  applicationName: BRAND_NAME,
  openGraph: {
    title: BRAND_NAME,
    description: `${BRAND_PRODUCT.crypto} and ${BRAND_PRODUCT.forex} on ${BRAND_NAME}.`,
    siteName: BRAND_NAME,
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const htmlLang = isAppLocale(locale) ? localeToHtmlLang(locale) : 'en';

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body className={`${inter.variable} ${orbitron.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <DockerUserAppHint />
            {children}
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
